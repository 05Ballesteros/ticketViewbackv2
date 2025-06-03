import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Estado } from 'src/schemas/estados.schema';
import { Model, Types } from 'mongoose';
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
import { Cliente } from 'src/schemas/cliente.schema';
import { CorreoService } from './correos.service';
import { channel } from 'diagnostics_channel';

interface UsuarioConRol {
    _id: Types.ObjectId;
    Rol: { _id: Types.ObjectId; Rol: string };
}

@Injectable()
export class PostTicketsService {
    constructor(
        private readonly getticketsService: GetTicketsService,
        private readonly userService: UserService,
        private readonly clienteService: ClienteService,
        private readonly correoService: CorreoService,
        @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
        @InjectModel(Estado.name) private readonly estadoModel: Model<Estado>,
    ) { }
    async crearTicket(dto: any, user: any, token: string, files: any): Promise<Ticket> {
        try {
            //1.-Verificar el asignado
            const dtoAsignado = await this.userService.verificarAsignado(dto);
            //2.- Verificar estado segun el asignado
            const dtoEstado = await this.getticketsService.getestadoTicket(dtoAsignado);
            //3.- Obtener información con la subcategoria
            const Categorizacion = await this.getticketsService.getCategorizacion(new Types.ObjectId(dto.Subcategoria));
            //4.- Calcular las fechas
            const Fecha_limite = calcularFechaResolucion(dto.Tiempo);
            //5.- Obtencion del asignado
            const asignado = await this.userService.getAsignado(dtoAsignado.Asignado_a);
            //6.- Se obtiene el cliente
            const cliente = await this.clienteService.getCliente(dto.Cliente);
            //5.- LLenado del hostorico
            const Historia_ticket = await historicoCreacion(user, asignado);
            let data = {
                Cliente: new Types.ObjectId(dto.Cliente),
                Medio: new Types.ObjectId(dto.Medio),
                Asignado_a: new Types.ObjectId(dto.Asignado_a),
                Subcategoria: new Types.ObjectId(dto.Subcategoria),
                Descripcion: dto.Descripcion,
                NumeroRec_Oficio: dto.NumeroRec_Oficio,
                Creado_por: new Types.ObjectId(user.UserId),
                Estado: dtoEstado.Estado,
                Area: Categorizacion?.Equipo,
                Fecha_hora_creacion: obtenerFechaActual(),
                Fecha_limite_resolucion_SLA: Fecha_limite,
                Fecha_limite_respuesta_SLA: addHours(obtenerFechaActual(), dto.Tiempo),
                Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                Fecha_hora_cierre: fechaDefecto,
                Fecha_hora_resolucion: fechaDefecto,
                Fecha_hora_reabierto: fechaDefecto,
                Historia_ticket: Historia_ticket,
            };
            //6.- Se guarda el ticket
            let ticketInstance = new this.ticketModel(data);
            const savedTicket = await ticketInstance.save();
            //7.- Se valida si el ticket se guardo correctamente
            if (savedTicket) {
                console.log("Ticket guardado correctamente");
                const { data: uploadedFiles } = await guardarArchivos(token, files);
                const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                    { _id: ticketInstance._id },
                    { $push: { Files: { $each: uploadedFiles.map((file) => ({ ...file, _id: new Types.ObjectId(), })), }, }, },
                    { new: true, upsert: true }
                );

                if (!updatedTicket) {
                    throw new BadRequestException('No se encontró el ticket para actualizar archivos.');
                }
                ticketInstance = updatedTicket;
            }
            //8.- Se genera el correoData
            let correoData = {
                idTicket: savedTicket.Id,
                correoUsuario: asignado?.Correo,
                correoCliente: cliente?.Correo,
                extensionCliente: cliente?.Extension,
                cuerpo: savedTicket.Descripcion,
            };
            //9.- Enviar correos
            const channel = "channel_crearTicket";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (correo) {
                console.log("Mensaje enviado al email service");
            }
            return savedTicket;
        } catch (error) {
            console.error("Error al crear el Ticket", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
}; 
