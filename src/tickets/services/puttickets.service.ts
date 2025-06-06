import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Estado } from 'src/schemas/estados.schema';
import { Ticket } from 'src/schemas/ticket.schema';
import { Usuario } from 'src/schemas/usuarios.schema';
import { GetTicketsService } from './gettickets.service';
import { calcularFechaResolucion } from 'src/common/utils/calcularFechaResolucion';
import { fechaDefecto, obtenerFechaActual } from 'src/common/utils/fechas';
import { addHours } from 'date-fns';
import { historicoAsignacion, historicoCreacion } from 'src/common/utils/historico';
import { guardarArchivos } from 'src/common/utils/guardarArchivos';
import { UserService } from './user.service';
import { ClienteService } from './cliente.service';
import { CorreoService } from './correos.service';
import { Model, Connection, ClientSession, Types } from 'mongoose';


@Injectable()
export class PutTicketsService {
    constructor(
        private readonly getticketsService: GetTicketsService,
        private readonly userService: UserService,
        private readonly clienteService: ClienteService,
        private readonly correoService: CorreoService,
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
        @InjectModel(Estado.name) private readonly estadoModel: Model<Estado>,
    ) { }
    async asgnarTicket(ticketData: any, user: any, token: string, files: any, id: string): Promise<Ticket> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            // Declarar variables
            let Estado: string | null = null;

            // 1.- Validar si viene tiempo en ticketData para actualizar fechas
            if (ticketData.tiempo) {
                const tiempo = ticketData.tiempo;
                ticketData = {
                    ...ticketData,
                    Fecha_limite_resolucion_SLA: addHours(obtenerFechaActual(), tiempo),
                    Fecha_limite_respuesta_SLA: addHours(obtenerFechaActual(), tiempo),
                    Fecha_hora_cierre: fechaDefecto,
                };
                delete ticketData.tiempo;
            }

            // 2.- Obtener datos necesarios para actualizar el ticket
            const areaAsignado = await this.userService.getareaAsignado(ticketData.Asignado_a);
            const rolAsignado = await this.userService.getRolAsignado(ticketData.Asignado_a);
            const cliente = await this.clienteService.getCliente(ticketData.Cliente);
            const RolModerador = await this.userService.getRolModerador("Moderador");
            const Moderador = await this.userService.getModeradorPorAreayRol(areaAsignado, RolModerador);
            // 3.- Validar cuál estado asignar al ticket
            if (rolAsignado !== "Usuario") {
                Estado = await this.getticketsService.getEstado("NUEVOS");
            } else {
                Estado = await this.getticketsService.getEstado("ABIERTOS");

            }

            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            }
            //4.- Agregar la historia
            const Historia_ticket = await historicoAsignacion(user, ticketData,);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    ...ticketData,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    Estado: new Types.ObjectId(Estado),
                    standby: false,
                    areaAsignado,
                },
                $unset: {
                    PendingReason: "",
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };

            // Agregar `Reasignado_a` solo si es necesario
            if (rolAsignado !== "Usuario") {
                updateData.$set.Asignado_a = new Types.ObjectId(ticketData.Asignado_a);
            } else if (Moderador) {
                updateData.$set.Asignado_a = new Types.ObjectId(Moderador);
                updateData.$set.Reasignado_a = new Types.ObjectId(ticketData.Asignado_a);
            }

            //5.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true }
            );
            // 6.- Validar si hay archivos para guardar
            if (files.length > 0) {
                console.log("Guardando archivos");
                const { data: uploadedFiles } = await guardarArchivos(token, files);
                const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                    { _id: id },
                    {
                        $push: {
                            Files: uploadedFiles.map((file) => ({
                                ...file,
                                _id: new Types.ObjectId(),
                            })),
                        },
                    },
                    { new: true, upsert: true }
                );

                if (!updatedTicket) {
                    throw new BadRequestException("No se encontró el ticket para actualizar archivos.");
                }
            }
            console.log(updatedTicket.Asignado_a[0], updatedTicket.Reasignado_a[0]);
            //Se valida a quien se va enviar el correo de asignación
            const Usuario = await this.userService.getAsignado(
                (updatedTicket.Reasignado_a && updatedTicket.Reasignado_a.length > 0
                    ? updatedTicket.Reasignado_a[0]
                    : updatedTicket.Asignado_a[0]
                ).toString()
            );

            console.log("Usuario", Usuario);
            //7.- Enviar correos
            let correoData = {
                idTicket: updatedTicket.Id,
                correoUsuario: Usuario?.Correo,
                extensionCliente: cliente?.Extension,
                descripcionTicket: updatedTicket.Descripcion,
                nombreCliente: cliente?.Nombre,
                telefonoCliente: cliente?.Telefono,
                ubicacion: cliente?.Ubicacion,
                area: cliente?.direccion_area?.direccion_area,
            };
            const channel = "channel_asignarTicket";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (correo) {
                console.log("Mensaje enviado al email service");
            }

            return updatedTicket;
        } catch (error) {
            console.error("Error al crear el Ticket:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }

    };
}; 
