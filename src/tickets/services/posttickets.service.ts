import { BadRequestException, Injectable } from '@nestjs/common';
import { Estado } from 'src/schemas/estados.schema';
import { Ticket } from 'src/schemas/ticket.schema';
import { Usuario } from 'src/schemas/usuarios.schema';
import { GetTicketsService } from './gettickets.service';
import { calcularFechaResolucion } from 'src/common/utils/calcularFechaResolucion';
import { fechaDefecto, obtenerFechaActual } from 'src/common/utils/fechas';
import { addHours } from 'date-fns';
import { historicoCreacion } from 'src/common/utils/historico';
import { guardarArchivos } from 'src/common/utils/guardarArchivos';
import { UserService } from './user.service';
import { ClienteService } from './cliente.service';
import { Clientes } from 'src/schemas/cliente.schema';
import { CorreoService } from './correos.service';
import { channel } from 'diagnostics_channel';
import { CounterService } from './counter.service';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Connection, ClientSession, Types } from 'mongoose';
import { validarRol } from 'src/common/utils/validacionRolUsuario';

@Injectable()
export class PostTicketsService {
    constructor(
        private readonly getticketsService: GetTicketsService,
        private readonly userService: UserService,
        private readonly clienteService: ClienteService,
        private readonly correoService: CorreoService,
        private readonly counterService: CounterService,
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
        @InjectModel(Estado.name) private readonly estadoModel: Model<Estado>,
    ) { }
    async crearTicket(dto: any, user: any, token: string, files: any): Promise<{ message: string;  }> {
        const session: ClientSession = await this.connection.startSession();
        let committed = false; // ✅ Bandera

        session.startTransaction();
        try {
            //1.-Verificar el asignado
            const dtoAsignado = await this.userService.verificarAsignado(dto);
            //3.- Obtener información con la subcategoria
            const Categorizacion = await this.getticketsService.getCategorizacion(new Types.ObjectId(dto.Subcategoria));
            //4.- Calcular las fechas
            const Fecha_limite = calcularFechaResolucion(dto.Tiempo);
            //5.- Obtencion del asignado
            const asignado = await this.userService.getUsuario(dtoAsignado.Asignado_a);
            const rolAsignado = await this.userService.getRolAsignado(asignado?._id);
            //2.- Verificar estado segun el asignado
            const Estado = await this.getticketsService.getestadoTicket(rolAsignado);
            //6.- Se obtiene el cliente
            const cliente = await this.clienteService.getCliente(dto.Cliente);
            //5.- LLenado del hostorico
            const Historia_ticket = await historicoCreacion(user, asignado);
            const RolModerador = await this.userService.getRolModerador("Moderador");
            const Moderador = await this.userService.getModeradorPorAreayRol(asignado?.Area, RolModerador);
            const Id = await this.counterService.getNextSequence('Id');
            let data = {
                Cliente: new Types.ObjectId(dto.Cliente),
                Medio: new Types.ObjectId(dto.Medio),
                Subcategoria: new Types.ObjectId(dto.Subcategoria),
                Descripcion: dto.Descripcion,
                NumeroRec_Oficio: dto.NumeroRec_Oficio,
                Creado_por: new Types.ObjectId(user.UserId),
                Estado: Estado,
                Area: Categorizacion?.Equipo,
                Fecha_hora_creacion: obtenerFechaActual(),
                Fecha_limite_resolucion_SLA: Fecha_limite,
                Fecha_limite_respuesta_SLA: addHours(obtenerFechaActual(), dto.Tiempo),
                Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                Fecha_hora_cierre: fechaDefecto,
                Fecha_hora_resolucion: fechaDefecto,
                Fecha_hora_reabierto: fechaDefecto,
                Historia_ticket: Historia_ticket,
                Id: Id,
            };
            // Agregar `Asignado_a o Reasignado_a segun el rol` 
            const propiedadesRol = await validarRol(rolAsignado, Moderador, dto);
            // Agregar dinámicamente las propiedades al objeto `updateData.$set`
            data = {
                ...data,
                ...propiedadesRol,
            };
            //6.- Se guarda el ticket
            let ticketInstance = new this.ticketModel(data);
            const savedTicket = await ticketInstance.save({ session });
            console.log("ticket guardado", savedTicket);
            if (!savedTicket) { throw new BadRequestException('No se creó el ticket.'); }
            console.log("Ticket guardado correctamente");
            //7.- Se valida si el ticket se guardo correctamente y si hay archivos para guardar
            if (files.length > 0) {
                console.log("Ticket guardado:", savedTicket._id);
                const { data: uploadedFiles } = await guardarArchivos(token, files);
                if (uploadedFiles) { console.log("Se guradaron los archivos"); }
                const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                    ticketInstance._id, // ✅ usa solo el ID aquí (puede ser string o ObjectId)
                    { $push: { Files: { $each: uploadedFiles.map((file) => ({ ...file, _id: new Types.ObjectId() })) } } },
                    { new: true, upsert: false, session, }
                );

                if (!updatedTicket) {
                    throw new BadRequestException('No se encontró el ticket para actualizar archivos.');
                }
                console.log("Archivos guardados correctamente");
                ticketInstance = updatedTicket;
            }
            //8.- Se genera el correoData
            const Usuario = await this.userService.getUsuario(
                (savedTicket.Reasignado_a && savedTicket.Reasignado_a.length > 0
                    ? savedTicket.Reasignado_a[0]
                    : savedTicket.Asignado_a[0]
                ).toString()
            );
            let correoData = {
                idTicket: savedTicket.Id,
                correoUsuario: Usuario?.Correo,
                correoCliente: cliente?.Correo,
                extensionCliente: cliente?.Extension,
                descripcionTicket: savedTicket.Descripcion,
                nombreCliente: cliente?.Nombre,
                telefonoCliente: cliente?.Telefono,
                ubicacion: cliente?.Ubicacion,
                area: cliente?.direccion_area?.direccion_area,
            };
            //9.- Enviar correos
            const channel = "channel_crearTicket";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (correo) {
                console.log("Mensaje enviado al email service");
            }
            await session.commitTransaction();
            committed = true; // ✅ Marca que ya se hizo commit

            return {
                message: `Ticket ${savedTicket.Id} creado correctamente.`,
            };
        } catch (error) {
            await this.counterService.decrementSequence('Id');
            if (!committed) {
                await session.abortTransaction(); // ✅ Solo abortar si no se hizo commit
            }
            console.error("Error al crear el Ticket", error.message);
            throw new BadRequestException("Error interno del servidor.");
        } finally {
            session.endSession(); // ✅ Siempre se cierra aquí, una sola vez
        }
    };
}; 
