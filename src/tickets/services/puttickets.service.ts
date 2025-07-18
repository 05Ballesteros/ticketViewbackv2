import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Estado } from 'src/schemas/estados.schema';
import { Ticket } from 'src/schemas/ticket.schema';
import { Usuario } from 'src/schemas/usuarios.schema';
import { GetTicketsService } from './gettickets.service';
import { calcularFechaResolucion } from 'src/common/utils/calcularFechaResolucion';
import { fechaDefecto, obtenerFechaActual } from 'src/common/utils/fechas';
import { addHours } from 'date-fns';
import {
    historicoAceptarSolucion,
    historicoAsignacion,
    historicoCerrar,
    historicoCreacion,
    historicoEditar,
    historicoNota,
    historicoOficio,
    historicoPendingReason,
    historicoReabrir,
    historicoReasignacion,
    historicoRechazarSolucion,
    historicoRegresarMesa,
    historicoRegresarModerador,
    historicoRegresarResolutor,
    historicoResolver,
} from 'src/common/utils/historico';
import { guardarArchivos } from 'src/common/utils/guardarArchivos';
import { UserService } from './user.service';
import { ClienteService } from './cliente.service';
import { CorreoService } from './correos.service';
import { Model, Connection, ClientSession, Types } from 'mongoose';
import incTicketsUsuario from 'src/common/utils/ticketEnTiempo';
import * as fs from 'fs';
import FormData = require('form-data');
import { Clientes } from 'src/schemas/cliente.schema';
import { validarRol } from 'src/common/utils/validacionRolUsuario';
import { LogsService } from './logs.service';
import { FilaCorreosService } from './filacorreos.service';
import { Area } from 'src/schemas/area.schema';
import { Dependencia } from 'src/schemas/dependencia.schema';
import { DireccionGeneral } from 'src/schemas/direccion_general.schema';
import { DireccionArea } from 'src/schemas/direccionarea.schema';
import { Medio } from 'src/schemas/mediocontacto.schema';
import { Puesto } from 'src/schemas/puestos.schema';
import { RedisService } from 'src/redis/redis.service';
import {
    generateNotification
} from 'src/common/utils/generateNotificacion';
import { NotificationGateway } from 'src/notifications/notification.gateway';
import { handleKnownErrors } from 'src/common/utils/handle-known-errors.util';
import { Celula } from 'src/schemas/celula.schema';

@Injectable()
export class PutTicketsService {
    constructor(
        private readonly getticketsService: GetTicketsService,
        private readonly userService: UserService,
        private readonly logsService: LogsService,
        private readonly clienteService: ClienteService,
        private readonly correoService: CorreoService,
        private readonly filacorreosService: FilaCorreosService,
        private readonly redisService: RedisService,
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
        @InjectModel(Estado.name) private readonly estadoModel: Model<Estado>,
        @InjectModel(Clientes.name) private readonly clienteModel: Model<Clientes>,
        @InjectModel(Area.name) private readonly areaModel: Model<Area>,
        @InjectModel(Dependencia.name)
        private readonly dependenciaModel: Model<Dependencia>,
        @InjectModel(DireccionGeneral.name)
        private readonly direcciongeneralModel: Model<DireccionGeneral>,
        @InjectModel(DireccionArea.name)
        private readonly direccionAreaModel: Model<DireccionArea>,
        @InjectModel(Medio.name) private readonly medioModel: Model<Medio>,
        @InjectModel(Puesto.name) private readonly puestoModel: Model<Puesto>,
    ) { }

    async asginarTicket(
        ticketData: any,
        user: any,
        token: string,
        files: any,
        id: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            console.log("ticketData", ticketData);
            // Declarar variables
            let Estado: any | null = null;

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
            const asignado = await this.userService.getUsuario(ticketData.Asignado_a);
            const rolAsignado = await this.userService.getRolAsignado(ticketData.Asignado_a);
            const cliente = await this.clienteService.getCliente(ticketData.Cliente);
            const RolModerador = await this.userService.getRolModerador('Moderador');
            const Moderador = await this.userService.getModeradorPorAreayRol(asignado?.Area, RolModerador);
            // 3.- Validar cuál estado asignar al ticket
            if (rolAsignado !== 'Usuario') {
                Estado = await this.getticketsService.getEstado('NUEVOS');
            } else {
                Estado = await this.getticketsService.getEstado('ABIERTOS');
            }

            if (!Estado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Estado no encontrado.');
            }
            //4.- Agregar la historia
            const Historia_ticket = await historicoAsignacion(user, ticketData);
            // Crear datos para el ticket
            // Agregar `Reasignado_a` solo si es necesario
            const propiedadesRol = await validarRol(rolAsignado, Moderador, ticketData);
            const idParaCelulas = propiedadesRol.Reasignado_a || propiedadesRol.Asignado_a;
            const { Cliente, ...filteredTicketData } = ticketData; //Se hace para excluir el cliente y que no se guarde como string
            const updateData: any = {
                $set: {
                    Asignado_a: propiedadesRol.Asignado_a,
                    Reasignado_a: propiedadesRol.Reasignado_a,
                    Celulas: await this.userService.obtenerPorUsuario(idParaCelulas),
                    Nota: ticketData.Nota,
                    Files: ticketData.Files,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    Estado: new Types.ObjectId(Estado),
                    standby: false,
                    AreaTicket: asignado?.Area && Array.isArray(asignado?.Area)
                        ? asignado?.Area.map(area => area._id)
                        : [],
                },
                $unset: {
                    PendingReason: '',
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            //5.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            // 6.- Validar si hay archivos para guardar
            if (files.length > 0) {
                console.log('Guardando archivos');
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
                    { new: true, upsert: true },
                );

                if (!updatedTicket) {
                    await this.logsService.enviarLog({ message: "❌ Error al guardar archivos en el ticket." }, "genericLog", token);
                    throw new BadRequestException("Error al guardar archivos en el ticket.");
                }
            }
            //Se valida a quien se va enviar el correo de asignación
            const Usuario = await this.userService.getUsuario(
                (updatedTicket.Reasignado_a && updatedTicket.Reasignado_a.length > 0
                    ? updatedTicket.Reasignado_a[0]
                    : updatedTicket.Asignado_a[0]
                ).toString(),
            );
            //7.- Enviar correos
            const correoData = {
                Id: updatedTicket.Id,
                destinatario: Usuario?.Correo,
                details: updatedTicket.Descripcion,
                nombre: cliente?.Nombre,
                extension: cliente?.Extension,
                telefono: cliente?.Telefono,
                ubicacion: cliente?.Ubicacion,
                area: cliente?.direccion_area?.direccion_area,
                emails_extra: <string[]>[],
                motivo: "",
            };

            try {
                const correo = await this.correoService.enviarCorreo(correoData, "channel_asignarTicket", token);
                if (correo) {
                    console.log("Mensaje enviado al email service");
                    const savedlog = await this.logsService.enviarLog(correoData, "successCorreoTicket", token, "asignado");
                }
            } catch (correoError) {
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                const savedlog = await this.logsService.enviarLog(correoData, "errorCorreo", token, "asignado");
                correoData.motivo = "Error de envío: asignación de ticket.";
                const savedCorreo = await this.filacorreosService.agregarCorreo(correoData, "channel_asignarTicket", EstadoCorreo as Types.ObjectId);
                return {
                    message: `Ticket ${updatedTicket.Id} asignado correctamente, correo agregado a la fila.`,
                };
            }

            await generateNotification(
                this.redisService,
                [updatedTicket.Asignado_a],
                updatedTicket.Id,
                `El Ticket #${updatedTicket.Id} se te ha asignado.`,
                'Ticket Asignado',
            );

            return {
                message: `Ticket ${updatedTicket.Id} asignado correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Error al asignar el Ticket." }, "genericLog", token);
            throw new BadRequestException("❌ Error al asignar el Ticket.");
        }
    }
    async reasginarTicket(
        ticketData: any,
        user: any,
        token: string,
        files: any,
        id: string,
    ): Promise<{ message: string }> {
        let Estado: any;
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        function deleteCamposTiempo(ticketData: any) {
            const {
                Prioridad,
                Fecha_limite_respuesta_SLA,
                Fecha_limite_resolucion_SLA,
                ...rest
            } = ticketData;
            return rest;
        }
        function tiempoResolucion(ticketData: any) {
            return {
                ...ticketData,
                Fecha_limite_respuesta_SLA: addHours(
                    obtenerFechaActual(),
                    ticketData.Fecha_limite_respuesta_SLA,
                ),
                Fecha_limite_resolucion_SLA: addHours(
                    obtenerFechaActual(),
                    ticketData.Fecha_limite_resolucion_SLA,
                ),
            };
        }
        const reasignado = !ticketData.Prioridad
            ? deleteCamposTiempo(ticketData)
            : tiempoResolucion(ticketData);
        try {
            const Reasignado = ticketData.Reasignado_a;
            const Usuario = await this.userService.getUsuario(Reasignado);
            // 1.- Obtener area del reasignado para actualizar el ticket
            const areaReasignado = await this.userService.getareaAsignado(Reasignado);
            const rolReasignado = await this.userService.getRolAsignado(
                ticketData.Reasignado_a,
            );
            if (!areaReasignado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException(
                    'Ocurrio un error al modificar el estado del ticket.',
                );
            }
            //2.- Agregar la historia
            const { Cliente, Nota, ...filteredTicketData } = reasignado; //Se hace para excluir el cliente y que no se guarde como string
            const Historia_ticket = await historicoReasignacion(user, Usuario);
            const Nota_ticket = await historicoNota(user, reasignado);
            console.log(' filteredTicketData', filteredTicketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    ...filteredTicketData,
                    Celulas: await this.userService.obtenerPorUsuario(filteredTicketData.Reasignado_a),
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    vistoBueno: reasignado.vistoBueno,
                    AreaTicket: areaReasignado && Array.isArray(areaReasignado)
                        ? areaReasignado.map(area => area._id)
                        : [],
                },
                $push: {
                    Historia_ticket: {
                        $each: [...Historia_ticket, ...Nota_ticket],
                    },
                },
            };

            // 3.- Obtener Estado para actualizar el ticket
            if (rolReasignado === 'Moderador') {
                updateData.$set.Estado =
                    await this.getticketsService.getEstado('NUEVOS');
                updateData.$set.Asignado_a = new Types.ObjectId(
                    ticketData.Reasignado_a,
                );
                updateData.$set.Reasignado_a = [];
            } else {
                updateData.$set.Estado =
                    await this.getticketsService.getEstado('ABIERTOS');
                updateData.$set.Reasignado_a = new Types.ObjectId(
                    ticketData.Reasignado_a,
                );
            }
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findOneAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            // 5.- Validar si hay archivos para guardar
            if (files.length > 0) {
                console.log('Guardando archivos');
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
                    { new: true, upsert: true },
                );

                if (!updatedTicket) {
                    throw new BadRequestException(
                        'No se encontró el ticket para actualizar archivos.',
                    );
                }
            }
            //Se valida a quien se va enviar el correo de asignación
            const cliente = await this.clienteService.getCliente(
                updatedTicket?.Cliente,
            );
            //7.- Enviar correos
            const correoData = {
                Id: updatedTicket.Id,
                destinatario: Usuario?.Correo,
                extension: cliente?.Extension,
                details: updatedTicket.Descripcion,
                nombre: cliente?.Nombre,
                telefono: cliente?.Telefono,
                ubicacion: cliente?.Ubicacion,
                area: cliente?.direccion_area?.direccion_area,
                emails_extra: <string[]>[],
                motivo: "",
            };
            const channel = 'channel_reasignarTicket';
            try {
                const correo = await this.correoService.enviarCorreo(
                    correoData,
                    channel,
                    token,
                );
                if (correo) {
                    console.log("Mensaje enviado al email service");
                    const savedlog = await this.logsService.enviarLog(correoData, "successCorreoTicket", token, "reasignado"); //Se necesita el Id, la acción y el destinatario
                }
            } catch (correoError) {
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                correoData.motivo = "Error de envío: reasignación de ticket.";
                const savedlog = await this.logsService.enviarLog(correoData, "errorCorreo", token, "reasignado");
                const savedCorreo = await this.filacorreosService.agregarCorreo(correoData, channel, EstadoCorreo as Types.ObjectId);
                return {
                    message: `Ticket ${updatedTicket.Id} reasignado correctamente, correo agregado a la fila.`,
                };
            }

            await generateNotification(
                this.redisService,
                [updatedTicket.Reasignado_a],
                updatedTicket.Id,
                `El Ticket #${updatedTicket.Id} se te ha asignado.`,
                'Ticket Reasignado',
            );

            return {
                message: `Ticket ${updatedTicket.Id} reasignado correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Error al reasignar el Ticket." }, "genericLog", token);
            throw new BadRequestException("❌ Error al reasignar el Ticket.");
        }
    }
    async reabrirTicket(
        ticketData: any,
        user: any,
        token: string,
        files: any,
        id: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            // Declarar variables
            let Estado: any | null = null;

            // 2.- Obtener datos necesarios para actualizar el ticket
            const areaAsignado = await this.userService.getareaAsignado(
                ticketData.Asignado_a,
            );
            const rolAsignado = await this.userService.getRolAsignado(
                ticketData.Asignado_a,
            );
            const RolModerador = await this.userService.getRolModerador('Moderador');
            const Moderador = await this.userService.getModeradorPorAreayRol(
                areaAsignado,
                RolModerador,
            );
            // 3.- Validar cuál estado asignar al ticket
            Estado = await this.getticketsService.getEstado('REABIERTOS');
            if (!Estado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Estado no encontrado.');
            }
            //4.- Agregar la historia
            console.log("areaAsignado", areaAsignado);
            const Historia_ticket = await historicoReabrir(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    ...ticketData,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    Estado: new Types.ObjectId(Estado),
                    AreaTicket: areaAsignado && Array.isArray(areaAsignado)
                        ? areaAsignado.map(area => area._id)
                        : [],
                        Celulas: await this.userService.obtenerPorUsuario(ticketData?.Asignado_a),
                },
                $unset: {
                    PendingReason: "",
                    Respuesta_cierre_reasignado: "",
                    Descripcion_cierre: "",
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                    Reabierto: { Fecha: obtenerFechaActual() },
                },
            };

            // Agregar `Reasignado_a` solo si es necesario
            if (rolAsignado !== 'Usuario') {
                updateData.$set.Asignado_a = new Types.ObjectId(ticketData.Asignado_a);
            } else if (Moderador) {
                updateData.$set.Asignado_a = new Types.ObjectId(Moderador);
                updateData.$set.Reasignado_a = new Types.ObjectId(
                    ticketData.Asignado_a,
                );
            }

            //5.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            // 6.- Validar si hay archivos para guardar
            if (files.length > 0) {
                console.log('Guardando archivos');
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
                    { new: true, upsert: true },
                );

                if (!updatedTicket) {
                    throw new BadRequestException(
                        'No se encontró el ticket para actualizar archivos.',
                    );
                }
            }
            console.log(updatedTicket.Asignado_a[0], updatedTicket.Reasignado_a[0]);
            //Se valida a quien se va enviar el correo de asignación
            const Usuario = await this.userService.getUsuario(ticketData.Asignado_a);
            const cliente = await this.clienteService.getCliente(
                updatedTicket.Cliente,
            );
            //7.- Enviar correos
            const correoData = {
                Id: updatedTicket.Id,
                destinatario: cliente?.Correo,
                emails_extra: Usuario?.Correo ? [Usuario?.Correo] : <string[]>[],
                details: updatedTicket.Descripcion,
                nombre: cliente?.Nombre,
                extension: cliente?.Extension,
                telefono: cliente?.Telefono,
                ubicacion: cliente?.Ubicacion,
                area: cliente?.direccion_area?.direccion_area,
                motivo: "",
            };
            const channel = 'channel_reabrirTicket';
            try {
                const correo = await this.correoService.enviarCorreo(
                    correoData,
                    channel,
                    token,
                );
                if (correo) {
                    console.log("Mensaje enviado al email service");
                    const savedlog = await this.logsService.enviarLog(correoData, "successCorreoTicket", token, "reabierto");
                }
            } catch (correoError) {
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                const savedlog = await this.logsService.enviarLog(correoData, "errorCorreo", token, "reabierto");
                correoData.motivo = "Error de envío: reapertura de ticket.";
                const savedCorreo = await this.filacorreosService.agregarCorreo(correoData, channel, EstadoCorreo as Types.ObjectId);
                return {
                    message: `Ticket ${updatedTicket.Id} reabierto correctamente, correo agregado a la fila.`,
                };
            }

            await generateNotification(
                this.redisService,
                [updatedTicket.Asignado_a, updatedTicket.Reasignado_a],
                updatedTicket.Id,
                `El Ticket #${updatedTicket.Id} se te ha asignado.`,
                'Ticket Reabierto',
            );

            return {
                message: `Ticket ${updatedTicket.Id} reabierto correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Error al reabrir el Ticket." }, "genericLog", token);
            throw new BadRequestException("❌ Error al reabrir el Ticket.");
        }
    }
    async resolverTicket(
        ticketData: any,
        user: any,
        token: string,
        files: any,
        id: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        console.log("Revisar el vistobueno", ticketData);
        try {
            // Declarar variables
            let Estado: any | null = null;
            let asignado: Types.ObjectId[];
            let areaAsignado: Types.ObjectId[];

            // 1.- Obtener datos necesarios para actualizar el ticket
            if (user.rol === "Usuario" && ticketData.vistoBueno === "true") {
                Estado = await this.getticketsService.getEstado("REVISION");
                asignado = await this.getticketsService.getAsignado(id);
                areaAsignado = await this.userService.getareaAsignado(asignado);
                console.log("Areas de asignado", areaAsignado);
            } else {
                //Campos de mesa
                Estado = await this.getticketsService.getEstado('RESUELTOS');
                areaAsignado = await this.userService.getAreaMesa();
                console.log("Areas de mesa", areaAsignado);
            }
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Estado no encontrado.');
            }
            //3.- Agregar la historia
            const Historia_ticket = await historicoResolver(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    ...ticketData,
                    Fecha_hora_resolucion: obtenerFechaActual(),
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    Estado: new Types.ObjectId(Estado),
                    Resuelto_por: new Types.ObjectId(user.userId),
                    AreaTicket: areaAsignado && Array.isArray(areaAsignado)
                        ? areaAsignado.map(area => area._id)
                        : [],
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true },
            );
            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException(
                    'Ocurrió un error al resolver el ticket.',
                );
            }

            // 6.- Validar si hay archivos para guardar
            if (files.length > 0) {
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
                    { new: true, upsert: true },
                );

                if (!updatedTicket) {
                    throw new BadRequestException(
                        'No se encontró el ticket para actualizar archivos.',
                    );
                }
            }

            await generateNotification(
                this.redisService,
                [
                    updatedTicket.Asignado_a,
                    updatedTicket.Reasignado_a,
                    updatedTicket.Creado_por,
                ],
                updatedTicket.Id,
                `El Ticket #${updatedTicket.Id} fue resuelto.`,
                'Ticket Resuelto',
            );

            //Se valida a quien se va enviar el correo de asignación
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            console.error('Error al resolver el Ticket:', error.message);
            throw new BadRequestException('Error interno del servidor.');
        }
    }
    async aceptarResolucion(
        ticketData: any,
        user: any,
        id: string,
        token: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        console.log('Esto llega', ticketData);
        try {
            // Declarar variables
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado('RESUELTOS');
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Estado no encontrado.');
            }
            //3.- Agregar la historia
            const areaMesa = await this.userService.getAreaMesa();
            const Historia_ticket = await historicoAceptarSolucion(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    Estado,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    vistoBueno: false,
                    AreaTicket: areaMesa && Array.isArray(areaMesa)
                        ? areaMesa.map(area => area._id)
                        : [],
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException(
                    'Ocurrió un error al resolver el ticket.',
                );
            }

            if (!updatedTicket) {
                throw new BadRequestException(
                    'No se encontró el ticket para actualizar archivos.',
                );
            }

            await generateNotification(
                this.redisService,
                [
                    updatedTicket.Reasignado_a,
                ],
                updatedTicket.Id,
                `Tu resolución paraa el Ticket #${updatedTicket.Id} fué aceptada. El Ticket está en proceso de cierre.`,
                'Revisión de ticket aceptada',
            );
            //Se valida a quien se va enviar el correo de asignación
            await this.logsService.enviarLog({ message: `Solución aceptada para el ticket ${updatedTicket.Id}.` }, "genericLog", token);
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: `Error al aceptar solución.` }, "genericLog", token);
            throw new BadRequestException('Error interno del servidor.');
        }
    }
    async rechazarResolucion(
        ticketData: any,
        user: any,
        files: any,
        token: string,
        id: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        console.log('Esto llega', ticketData);
        try {
            // Declarar variables
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado('ABIERTOS');
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Estado no encontrado.');
            }
            //3.- Agregar la historia
            const Historia_ticket = await historicoRechazarSolucion(user, ticketData);
            const areaAsignado = await this.userService.getareaAsignado(ticketData.Reasignado_a);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    Estado,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    AreaTicket: areaAsignado && Array.isArray(areaAsignado)
                        ? areaAsignado.map(area => area._id)
                        : [],
                },
                $unset: {
                    Resuelto_por: '',
                    Respuesta_cierre_reasignado: '',
                    Fecha_hora_resolucion: '',
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException(
                    'Ocurrió un error al resolver el ticket.',
                );
            }
            if (files.length > 0) {
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
                    { new: true, upsert: true },
                );

                if (!updatedTicket) {
                    throw new BadRequestException(
                        'No se encontró el ticket para actualizar archivos.',
                    );
                }
            }

            await generateNotification(
                this.redisService,
                [
                    updatedTicket.Reasignado_a,
                ],
                updatedTicket.Id,
                `Tu resolución para el Ticket #${updatedTicket.Id} fué rechazada. Puedes validar los motivos en la historia del ticket.`,
                'Revisión de ticket rechazada',
            );
            await this.logsService.enviarLog({ message: `Solución rechazada para el ticket ${updatedTicket.Id}.` }, "genericLog", token);
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: `Error al rechazar solución.` }, "genericLog", token);
            throw new BadRequestException('Error interno del servidor.');
        }
    }
    async regresarTicketMesa(
        ticketData: any,
        user: any,
        files: any,
        token: string,
        id: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            console.log('ticketData', ticketData);
            // 1.- Consultar estado
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado('STANDBY');
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Estado no encontrado.');
            }
            //3.- Consultar área de mesa
            const AreaTicket =
                await this.getticketsService.getAreaPorNombre('Mesa de Servicio');
            if (!AreaTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Área no encontrada.');
            }
            //3.- Agregar la historia
            const Historia_ticket = await historicoRegresarMesa(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    Estado,
                    AreaTicket,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    standby: true,
                    Asignado_a: await this.userService.getUsuarioMesa('standby'),
                },
                $unset: { Reasignado_a: [], Celulas: [] },
                $push: { Historia_ticket: { $each: Historia_ticket } },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException(
                    'Ocurrió un error al resolver el ticket.',
                );
            }
            if (files.length > 0) {
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
                    { new: true, upsert: true },
                );

                if (!updatedTicket) {
                    throw new BadRequestException(
                        'No se encontró el ticket para actualizar archivos.',
                    );
                }
            }
            const correoData = {
                Id: updatedTicket.Id,
                details: ticketData.descripcion_retorno,
                motivo: "",
            };
            const channel = 'channel_regresarTicketMesa';
            try {
                console.log('1');
                const correo = await this.correoService.enviarCorreo(
                    correoData,
                    channel,
                    token,
                );
                if (correo) {
                    console.log("Mensaje enviado al email service");
                    const savedlog = await this.logsService.enviarLog(correoData, "successCorreoTicket", token, "devuelto a mesa de servicio");
                }
            } catch (correoError) {
                console.log("2");
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                const savedlog = await this.logsService.enviarLog(correoData, "errorCorreo", token, "devuelto a mesa de servicio");
                correoData.motivo = "Error de envío: regresar ticket a mesa.";
                const savedCorreo = await this.filacorreosService.agregarCorreo(correoData, channel, EstadoCorreo as Types.ObjectId);
                return {
                    message: `Ticket ${updatedTicket.Id} devuelto a mesa de servicio correctamente, correo agregado a la fila.`,
                };
            }

            await generateNotification(
                this.redisService,
                [
                    updatedTicket.Creado_por,
                ],
                updatedTicket.Id,
                `El Ticket #${updatedTicket.Id} fué retornado a mesa de servicio. Puedes verlo en la sección: Tickets > Mesa de servicio.`,
                'Ticket retornado a mesa de servicio',
            );

            return {
                message: `Ticket ${updatedTicket.Id} devuelto a mesa de servicio correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Error al devolver el ticket a mesa de servicio." }, "genericLog", token);
            throw new BadRequestException("❌ Error al devolver el ticket a mesa de servicio.");
        }
    }
    async regresarTicketModerador(
        ticketData: any,
        user: any,
        files: any,
        token: string,
        id: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            //1.-Consultar ticket
            const ticket = await this.getticketsService.getTicketsPor_Id(id);
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado('NUEVOS');
            if (!Estado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Estado no encontrado.');
            }
            const AreaTicket = await this.getticketsService.getArea(
                ticket?.Asignado_a[0]._id,
            );
            console.log('AreaTicket', AreaTicket);
            if (!AreaTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Área no encontrada.');
            }
            //3.- Agregar la historia
            const Historia_ticket = await historicoRegresarModerador(
                user,
                ticketData,
            );
            const updateData: any = {
                $set: {
                    Estado,
                    AreaTicket,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    vistoBueno: false,
                    Celulas: await this.userService.obtenerPorUsuario(ticket?.Asignado_a[0]._id),
                },
                $unset: { Reasignado_a: [] },
                $push: { Historia_ticket: { $each: Historia_ticket } },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException(
                    'Ocurrió un error al resolver el ticket.',
                );
            }
            if (files.length > 0) {
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
                    { new: true, upsert: true },
                );

                if (!updatedTicket) {
                    throw new BadRequestException(
                        'No se encontró el ticket para actualizar archivos.',
                    );
                }
            }
            const correoData = {
                Id: updatedTicket.Id,
                destinatario: await this.userService.getCorreoUsuario(
                    updatedTicket.Asignado_a[0],
                ), //Moderador
                details: ticketData.descripcion_retorno,
                emails_extra: <string[]>[],
                motivo: "",
            };
            const channel = 'channel_regresarTicketModerador';
            try {
                const correo = await this.correoService.enviarCorreo(
                    correoData,
                    channel,
                    token,
                );
                if (correo) {
                    console.log("Mensaje enviado al email service");
                    const savedlog = await this.logsService.enviarLog(correoData, "successCorreoTicket", token, "devuelto a moderador");
                }
            } catch (correoError) {
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                const savedlog = await this.logsService.enviarLog(correoData, "errorCorreo", token, "devuelto a moderador");
                correoData.motivo = "Error de envío: regresar ticket a moderador.";
                const savedCorreo = await this.filacorreosService.agregarCorreo(correoData, channel, EstadoCorreo as Types.ObjectId);
                return {
                    message: `Ticket ${updatedTicket.Id} devuelto a moderador correctamente, correo agregado a la fila.`,
                };
            }

            await generateNotification(
                this.redisService,
                [
                    updatedTicket.Asignado_a,
                ],
                updatedTicket.Id,
                `El Ticket #${updatedTicket.Id} fué retornado a moderador. Puedes verlo en la sección: Tickets > Nuevos.`,
                'Ticket retornado a moderador',
            );

            return {
                message: `Ticket ${updatedTicket.Id} devuelto a moderador correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Error al devolver el ticket al moderador." }, "genericLog", token);
            throw new BadRequestException("❌ Error al devolver el ticket al moderador.");
        }
    }
    async regresarTicketResolutor(
        ticketData: any,
        user: any,
        files: any,
        token: string,
        id: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            console.log('ticketData', ticketData);
            // 1.- Consultar estado
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado('ABIERTOS');
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Estado no encontrado.');
            }
            //3.- Agregar la historia
            const Historia_ticket = await historicoRegresarResolutor(
                user,
                ticketData,
            );
            const areaReasignado = await this.userService.getareaAsignado(ticketData.Reasignado_a);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    Estado, Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    AreaTicket: areaReasignado && Array.isArray(areaReasignado)
                        ? areaReasignado.map(area => area._id)
                        : [],
                },
                $push: { Historia_ticket: { $each: Historia_ticket } },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException(
                    'Ocurrió un error al resolver el ticket.',
                );
            }
            if (files.length > 0) {
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
                    { new: true, upsert: true },
                );

                if (!updatedTicket) {
                    throw new BadRequestException(
                        'No se encontró el ticket para actualizar archivos.',
                    );
                }
            }
            //Falta lo del correo y crear el canal en emailservice.
            const Usuario = await this.userService.getUsuario(
                updatedTicket.Reasignado_a[0]._id.toString(),
            );
            //7.- Enviar correos
            const correoData = {
                Id: updatedTicket.Id,
                destinatario: Usuario?.Correo,
                details: ticketData.Descripcion_respuesta_cliente,
                emails_extra: <string[]>[],
                motivo: "",
            };

            const channel = 'channel_regresarTicketResolutor';
            try {
                const correo = await this.correoService.enviarCorreo(
                    correoData,
                    channel,
                    token,
                );
                if (correo) {
                    console.log("Mensaje enviado al email service");
                    const savedlog = await this.logsService.enviarLog(correoData, "successCorreoTicket", token, "devuelto a resolutor");
                }
            } catch (correoError) {
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                const savedlog = await this.logsService.enviarLog(correoData, "errorCorreo", token, "devuelto a resolutor");
                correoData.motivo = "Error de envío: regresar ticket a resolutor.";
                const savedCorreo = await this.filacorreosService.agregarCorreo(correoData, channel, EstadoCorreo as Types.ObjectId);
                return {
                    message: `Ticket ${updatedTicket.Id} devuelto a resolutor correctamente, correo agregado a la fila.`,
                };
            }

            await generateNotification(
                this.redisService,
                [
                    updatedTicket.Reasignado_a,
                ],
                updatedTicket.Id,
                `El Ticket #${updatedTicket.Id} fué retornado al resolutor del ticket. Puedes verlo en la sección: Tickets > En Curso.`,
                'Ticket retornado a resolutor',
            );

            return {
                message: `Ticket ${updatedTicket.Id} devuelto a resolutor correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Error al devolver el ticket al resolutor." }, "genericLog", token);
            throw new BadRequestException("❌ Error al devolver el ticket al resolutor.");
        }
    }
    async cerrarTicket(
        ticketData: any,
        user: any,
        token: string,
        files: any,
        id: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            // Declarar variables
            let Estado: any | null = null;
            // 1.- Obtener el estado CERRADOS
            Estado = await this.getticketsService.getEstado('CERRADOS');
            if (!Estado) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException('Estado no encontrado.');
            }
            //2.- Agregar la historia
            const Historia_ticket = await historicoCerrar(user, ticketData);
            const areaResolutor = await this.userService.getareaAsignado(ticketData.Resuelto_por);
            //3.- Crear datos para el ticket
            const updateData: any = {
                $set: {
                    Descripcion_cierre: ticketData.Descripcion_cierre,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    Cerrado_por: new Types.ObjectId(user.userId),
                    Estado: new Types.ObjectId(Estado),
                    AreaTicket: areaResolutor && Array.isArray(areaResolutor)
                        ? areaResolutor.map(area => area._id)
                        : [],
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };

            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            if (!updatedTicket) {
                await this.logsService.enviarLog({ message: "❌ No fue posible cerrar el ticket." }, "genericLog", token);
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                return {
                    message: `No fue posible cerrar el ticket.`,
                };
            } else {
                const result = incTicketsUsuario(
                    updatedTicket.Fecha_hora_resolucion,
                    updatedTicket.Fecha_limite_resolucion_SLA,
                );
                const resultIncTicketsUsuario = await this.userService.incTickets(
                    user,
                    result,
                );

                if (!resultIncTicketsUsuario) {
                    console.log('Transacción abortada.');
                    await session.abortTransaction();
                    session.endSession();
                    throw new BadRequestException(
                        'Ocurrió un error al actualizar el contador de tickets del usuario.',
                    );
                }
            }
            const cliente = await this.clienteService.getCliente(
                updatedTicket.Cliente,
            );
            //7.- Enviar correos
            const formData = new FormData();
            const correoData = {
                Id: updatedTicket.Id,
                destinatario: cliente.Correo,
                details: ticketData.Descripcion_cierre,
                emails_extra: <string[]>[],
                motivo: "",
            };
            console.log('correoData', correoData);

            formData.append('correoData', JSON.stringify(correoData));

            if (files.length > 0) {
                files.forEach((file) => {
                    const buffer = fs.readFileSync(file.path);
                    formData.append('files', buffer, file.originalname);
                });
            }

            try {
                const correo = await this.correoService.enviarCorreoHTTP(
                    formData,
                    'cerrar',
                    updateData._id,
                    token,
                );
                if (correo) {
                    console.log("Mensaje enviado al email service");
                    const savedlog = await this.logsService.enviarLog(correoData, "successCorreoTicket", token, "cerrado");
                }
            } catch (correoError) {
                let uploadedFiles = [];
                if (files.length > 0) {
                    console.log('Guardando archivos');
                    const result = await guardarArchivos(token, files);
                    uploadedFiles = result?.data;
                    if (!result) {
                        await this.logsService.enviarLog({ message: "❌ Error al subir archivos." }, "genericLog", token);
                        throw new BadRequestException("Error al subir archivos.");
                    }
                }
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                const savedlog = await this.logsService.enviarLog(correoData, "errorCorreo", token, "cerrado");
                correoData.motivo = "Error de envío: cierre de ticket.";
                const savedCorreo = await this.filacorreosService.agregarCorreoHTTP(correoData, "cerrar", EstadoCorreo as Types.ObjectId, uploadedFiles);
                return {
                    message: `Ticket ${updatedTicket.Id} cerrado correctamente, correo agregado a la fila.`,
                };
            }

            await generateNotification(
                this.redisService,
                [
                    updatedTicket.Asignado_a, updatedTicket.Reasignado_a, updatedTicket.Creado_por,
                ],
                updatedTicket.Id,
                `El Ticket #${updatedTicket.Id} fué cerrado. Puedes verlo en la sección: Tickets > Cerrados.`,
                'Ticket cerrado',
            );

            return {
                message: `Ticket ${updatedTicket.Id} cerrado correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Error al cerrar el Ticket." }, "genericLog", token);
            throw new BadRequestException("❌ Error al cerrar el Ticket.");
        }
    }
    async agregarNota(
        ticketData: any,
        user: any,
        files: any,
        id: string,
        token: string,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        let destinatario = '';
        const emails_extra: string[] = [];
        try {
            const Historia_ticket = await historicoNota(user, ticketData);
            const updateData: any = {
                $set: { Fecha_hora_ultima_modificacion: obtenerFechaActual() },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            // Si hay archivos, los subimos y agregamos al mismo updateData
            if (files.length > 0) {
                const { data: uploadedFiles } = await guardarArchivos(token, files);

                // Agrega $push.Files al mismo objeto updateData
                updateData.$push.Files = {
                    $each: uploadedFiles.map((file) => ({
                        ...file,
                        _id: new Types.ObjectId(),
                    })),
                };
            }

            // Ejecutar solo un findByIdAndUpdate
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                id, // ✅ solo el ID
                updateData,
                { new: true },
            );

            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                return { message: `No fue posible agregar la Nota.` };
            }

            if (user.rol === 'Usuario') {
                destinatario =
                    (await this.userService.getCorreoUsuario(
                        updatedTicket.Asignado_a[0],
                    )) ?? ''; //Moderador
                //const PM = await this.userService.getCorreoUsuario(updatedTicket.Reasignado_a[0]); //PM
                // if (PM) {
                //     emails_extra.push(PM);
                // }
            } else if (user.rol === 'Moderador') {
                destinatario =
                    (await this.userService.getCorreoUsuario(
                        updatedTicket.Reasignado_a[0],
                    )) ?? ''; //Resolutor
                //const PM = await this.userService.getCorreoUsuario(updatedTicket.Reasignado_a[0]); //PM
                // if (PM) {
                //     emails_extra.push(PM);
                // }
            } else if (user.rol === 'Auditor') {
                destinatario =
                    (await this.userService.getCorreoUsuario(
                        updatedTicket.Asignado_a[0],
                    )) ?? ''; //Moderador
                const Resolutor = await this.userService.getCorreoUsuario(
                    updatedTicket.Reasignado_a[0],
                ); //Resolutor
                if (Resolutor) {
                    emails_extra.push(Resolutor);
                }
            } else {
                destinatario =
                    (await this.userService.getCorreoUsuario(
                        updatedTicket.Asignado_a[0],
                    )) ?? ''; //el asignado siempre va a ser mesa, no se deben enviar correos a mesa
                const Resolutor = await this.userService.getCorreoUsuario(
                    updatedTicket.Reasignado_a[0],
                ); //Resolutor
                //const PM = await this.userService.getCorreoUsuario(updatedTicket.Reasignado_a[0]); //PM
                if (Resolutor) {
                    emails_extra.push(Resolutor);
                }
            }

            const correoData = {
                Id: updatedTicket.Id,
                destinatario: destinatario,
                emails_extra,
                details: ticketData.Nota,
                motivo: "",
            };

            if (!destinatario) {
                console.warn('No hay destinatarios válidos para enviar el correo.');
                await session.abortTransaction();
                session.endSession();
                return {
                    message: `Nota agregada correctamente al Ticket ${updatedTicket.Id}.`,
                };
            }
            const channel = "channel_notas";
            if (correoData.destinatario !== process.env.CORREOMESA_TEST) {
                try {
                    const correo = await this.correoService.enviarCorreo(correoData, channel, token);
                    if (correo) {
                        const savedlog = await this.logsService.enviarLog(correoData, "successCorreoTicket", token, "nota agregada");
                    }
                } catch (correoError) {
                    const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                    const savedlog = await this.logsService.enviarLog(correoData, "errorCorreo", token, "nota agregada");
                    correoData.motivo = "Error de envío: agregar nota.";
                    const savedCorreo = await this.filacorreosService.agregarCorreo(correoData, channel, EstadoCorreo as Types.ObjectId);
                    return {
                        message: ` Nota agregada correctamente al Ticket ${updatedTicket.Id}, correo agregado a la fila.`,
                    };
                }
            } else {
                try {
                    await this.logsService.enviarLog({ message: `✅ Nota agregada correctamente al Ticket ${updatedTicket.Id}` }, "genericLog", token);
                } catch (logError) {
                    console.error('Error al registrar log genérico:', logError);
                    // No se lanza error para no afectar el flujo
                }
            }

            await generateNotification(
                this.redisService,
                [
                    updatedTicket.Asignado_a, updatedTicket.Reasignado_a,
                ],
                updatedTicket.Id,
                `El Ticket #${updatedTicket.Id} tiene una nueva nota.`,
                'Nueva nota',
            );

            return {
                message: `Nota agregada correctamente al Ticket ${updatedTicket.Id}.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Error al agregar la nota." }, "genericLog", token);
            throw new BadRequestException("❌ Error al agregar la nota.");
        }
    };
    async marcarTicketPendiente(_id: string, user: { userId: string; nombre: string }, cuerpoCorreo: string, emails_extra: string[], files: Express.Multer.File[], token: string,): Promise<{ message: string; }> {
        const rawEmailsExtra = emails_extra as string | string[] | undefined;
        let emailsArray: string[] = [];
        try {
            const resultEstado =
                await this.getticketsService.getIdEstadoTicket('PENDIENTES');

            if (!resultEstado) {
                throw new NotFoundException('No se encontro el estado del ticket.');
            }

            const { userId, nombre } = user;
            const areaMesa = await this.userService.getAreaMesa();
            const result = await this.ticketModel.findOneAndUpdate(
                { _id },
                {
                    $set: {
                        Estado: resultEstado._id,
                        AreaTicket: areaMesa && Array.isArray(areaMesa)
                            ? areaMesa.map(area => area._id)
                            : [],
                    },
                    $push: {
                        Historia_ticket: {
                            Nombre: userId,
                            Titulo: 'Ticket Pendiente',
                            Mensaje: `Ticket marcado como pendiente. ${nombre} se ha puesto en contacto mediante correo electrónico con el cliente. Mensaje incluido en el correo: <${cuerpoCorreo}>`,
                            stopper: true,
                        },
                    },
                },
                { new: true },
            );

            if (!result) {
                throw new BadRequestException('No se pudo actualizar el ticket.');
            }

            const cliente = await this.clienteModel
                .findById(result.Cliente)
                .select('Nombre Correo');

            if (!cliente) {
                throw new NotFoundException(
                    'No se encontró la informacion del cliente.',
                );
            }

            const formData = new FormData();

            if (Array.isArray(rawEmailsExtra)) {
                emailsArray = rawEmailsExtra.map(email => email.trim());
            } else if (typeof rawEmailsExtra === 'string' && rawEmailsExtra.trim() !== '') {
                emailsArray = [rawEmailsExtra.trim()];
            }

            const correoData = {
                Id: result.Id,
                destinatario: process.env.CORREOMESA_TEST,
                emails_extra: [...emailsArray, cliente.Correo],
                details: cuerpoCorreo,
                motivo: "",
            };

            formData.append('correoData', JSON.stringify(correoData));

            if (files.length > 0) {
                files.forEach((file) => {
                    const buffer = fs.readFileSync(file.path);
                    formData.append('files', buffer, file.originalname);
                });
            }

            try {
                const correo = await this.correoService.enviarCorreoHTTP(formData, 'pendiente', _id, token);
                console.log("Mensaje enviado al email service");
                const savedlog = await this.logsService.enviarLog(correoData, "successPendiente", token);
            } catch (correoError) {
                let uploadedFiles = [];
                if (files.length > 0) {
                    console.log('Guardando archivos');
                    const result = await guardarArchivos(token, files);
                    uploadedFiles = result?.data;
                    if (!result) {
                        await this.logsService.enviarLog({ message: "❌ Error al subir archivos." }, "genericLog", token);
                        throw new BadRequestException("Error al subir archivos.");
                    }
                }
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                const savedlog = await this.logsService.enviarLog(correoData, "errorPendiente", token);
                correoData.motivo = "Error de envío: marcar ticket pendiente.";
                console.log("uploadedFiles", uploadedFiles);
                const savedCorreo = await this.filacorreosService.agregarCorreoHTTP(correoData, "pendiente", EstadoCorreo as Types.ObjectId, uploadedFiles);
                return {
                    message: `Ticket ${result.Id} pendiente, correo agregado a la fila.`,
                };
            }
            return {
                message: `Ticket ${result.Id} marcado como pendiente correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌  Error al marcar el ticket como pendiente." }, "genericLog", token);
            throw new BadRequestException("❌ Error al marcar el ticket como pendiente.");
        }
    }
    async contactarCliente(
        _id: string,
        user: { userId: string; nombre: string },
        cuerpoCorreo: string,
        emails_extra: string[],
        files: Express.Multer.File[],
        token: string,
    ) {
        try {
            const { userId, nombre } = user;

            const result = await this.ticketModel.findOneAndUpdate(
                { _id },
                {
                    $set: { Fecha_hora_ultima_modificacion: obtenerFechaActual() },
                    $push: {
                        Historia_ticket: {
                            Nombre: userId,
                            Titulo: 'Contacto con el cliente',
                            Mensaje: `${nombre} se ha puesto en contacto mediante correo electrónico con el cliente. Cuerpo del correo: <${cuerpoCorreo}>`,
                            stopper: false,
                        },
                    },
                },
                { new: true },
            );

            if (!result) {
                throw new BadRequestException('No se pudo contactar al cliente.');
            }

            const cliente = await this.clienteModel
                .findById(result.Cliente)
                .select('Nombre Correo');

            if (!cliente) {
                throw new NotFoundException(
                    'No se encontró la informacion del cliente.',
                );
            }

            const formData = new FormData();

            const correoData = {
                Id: result.Id,
                destinatario: cliente.Correo,
                emails_extra,
                details: cuerpoCorreo,
                motivo: "",
            };
            console.log('CorreoData', correoData);
            formData.append('correoData', JSON.stringify(correoData));

            if (files.length > 0) {
                files.forEach((file) => {
                    const buffer = fs.readFileSync(file.path);
                    formData.append('files', buffer, file.originalname);
                });
            }

            try {
                const correo = await this.correoService.enviarCorreoHTTP(
                    formData,
                    'contactoCliente',
                    _id,
                    token,
                );
                console.log("Mensaje enviado al email service");
                const savedlog = await this.logsService.enviarLog(correoData, "successCorreoContacto", token);
            } catch (correoError) {
                let uploadedFiles = [];
                if (files.length > 0) {
                    console.log('Guardando archivos');
                    const result = await guardarArchivos(token, files);
                    uploadedFiles = result?.data;
                    if (!result) {
                        await this.logsService.enviarLog({ message: "❌ Error al subir archivos." }, "genericLog", token);
                        throw new BadRequestException("Error al subir archivos.");
                    }
                }
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                const savedlog = await this.logsService.enviarLog(correoData, "errorContacto", token);
                correoData.motivo = "Error de envío: contacto cliente.";
                const savedCorreo = await this.filacorreosService.agregarCorreoHTTP(correoData, "contactoCliente", EstadoCorreo as Types.ObjectId, uploadedFiles);
                return {
                    message: `No se pudo contactar al cliente, correo agregado a la fila.`,
                };
            }
            return {
                message: `Cliente contactado.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Error al contactar al cliente." }, "genericLog", token);
            handleKnownErrors(error, "Ocurrió un error al contactar al cliente")
            return { message: "No se pudo contactar al cliente por un error interno." };
        }
    }
    async PendingReason(
        ticketData: any,
        user: any,
        id: string,
        token: string,
    ) {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            console.log('ticketData', ticketData);
            const Historia_ticket = await historicoPendingReason(user, ticketData);
            const updateData: any = {
                $set: { PendingReason: ticketData.PendingReason },
                $push: { Historia_ticket: { $each: Historia_ticket } },
            };

            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            console.log(updatedTicket);
            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                await this.logsService.enviarLog({ message: `Error al agregar la razón pendiente.` }, "genericLog", token);
                return { message: `No fue posible agregar la razón pendiente.` };
            } else {
                await this.logsService.enviarLog({ message: `Razón pendiente agregada correctamente al Ticket ${updatedTicket.Id}.` }, "genericLog", token);
                return {
                    message: `Razón pendiente agregada correctamente al Ticket ${updatedTicket.Id}.`,
                };
            }
        } catch (error) {
            await this.logsService.enviarLog({ message: `Error al agregar la razón pendiente.` }, "genericLog", token);
            handleKnownErrors(error, "Ocurrió un error al agregar la razón pendiente al ticket")
            return { message: "No fue posible agregar la razón pendiente, error interno." };
        }
    }
    async editarTicket(
        ticketData: any,
        user: any,
        id: string,
        files: any,
        token: string,
    ) {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            const Historia_ticket = await historicoEditar(user);
            const updateData: any = {
                $set: {
                    Medio: ticketData.Medio,
                    Numero_Oficio: ticketData.NumeroRec_Oficio,
                    Descripcion: ticketData.Descripcion,
                },
                $push: { Historia_ticket: { $each: Historia_ticket } },
            };

            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );
            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                await this.logsService.enviarLog({ message: `Error al editar el Ticket.` }, "genericLog", token);
                return { message: `No fue posible editar el ticket.` };
            }

            if (files.length > 0) {
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
                    { new: true, upsert: true },
                );

                if (!updatedTicket) {
                    await this.logsService.enviarLog({ message: `No se encontró el ticket para actualizar archivos.` }, "genericLog", token);
                    throw new BadRequestException(
                        'No se encontró el ticket para actualizar archivos.',
                    );
                }
            }
            await this.logsService.enviarLog({ message: `Ticket ${updatedTicket.Id} guardado correctamente.` }, "genericLog", token);
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: `Error al editar el Ticket.` }, "genericLog", token);
            handleKnownErrors(error, "Ocurrió un error al editar la información del ticket")
        }
    }
    async agregarOficio(
        ticketData: any,
        user: any,
        files: any,
        id: string,
        token: string,
    ) {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            const Historia_ticket = await historicoOficio(user, ticketData);
            const updateData: any = {
                $set: { Numero_Oficio: ticketData.Numero_Oficio },
                $push: { Historia_ticket: { $each: Historia_ticket } },
            };
            if (files.length > 0) {
                const { data: uploadedFiles } = await guardarArchivos(token, files);

                // Agrega $push.Files al mismo objeto updateData
                updateData.$push.Files = {
                    $each: uploadedFiles.map((file) => ({
                        ...file,
                        _id: new Types.ObjectId(),
                    })),
                };
            }

            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true },
            );

            if (!updatedTicket) {
                console.log('Transacción abortada.');
                await session.abortTransaction();
                session.endSession();
                await this.logsService.enviarLog({ message: `Error al agregar oficio de cierre al Ticket.` }, "genericLog", token);
                return { message: `No fue posible agregar el oficio.` };
            } else {

                await generateNotification(
                    this.redisService,
                    [
                        updatedTicket.Asignado_a, updatedTicket.Reasignado_a, updatedTicket.Creado_por,
                    ],
                    updatedTicket.Id,
                    `Se agregó oficio de cierre al Ticket #${updatedTicket.Id}.`,
                    'Oficio de cierre agregado',
                );
                await this.logsService.enviarLog({ message: `Oficio de cierre agregado correctamente al Ticket ${updatedTicket.Id}.` }, "genericLog", token);
                return {
                    message: `Oficio de cierre agregado correctamente al Ticket ${updatedTicket.Id}.`,
                };
            }
        } catch (error) {
            await this.logsService.enviarLog({ message: `Error al agregar oficio de cierre al ticket.` }, "genericLog", token);
            handleKnownErrors(error, "Ocurrió un error al agregar el oficio de cierre")
        }
    }

    async updateArea(_id: string, Area: string, token: string) {
        try {
            const result = await this.areaModel.updateOne(
                { _id },
                { $set: { Area } },
            );
            if (!result) {
                await this.logsService.enviarLog({ message: `Ocurrio un error al actualizar el área.` }, "genericLog", token);
                throw new BadRequestException('Ocurrio un error al actualizar el área');
            }
            await this.logsService.enviarLog({ message: `El área se actualizó de manera correcta.` }, "genericLog", token);
            return { message: 'El área se actualizó de manera correcta' };
        } catch (error) {
            console.log(error);
            await this.logsService.enviarLog({ message: `Ocurrió un error al actualizar el área: Error interno en el servidor.` }, "genericLog", token);
            handleKnownErrors(error, "Ocurrió un error al actualizar el área")
        }
    }

    async updateDependencia(_id: string, Dependencia: string, token: string) {
        try {
            const result = await this.dependenciaModel.updateOne(
                { _id },
                { $set: { Dependencia } },
            );
            if (!result) {
                await this.logsService.enviarLog({ message: `Ocurrio un error al actualizar la dependencia.` }, "genericLog", token);
                throw new BadRequestException('Ocurrio un error al actualizar la dependencia');
            }
            await this.logsService.enviarLog({ message: `La dependencia se actualizó de manera correcta.` }, "genericLog", token);
            return { message: 'La dependencia se actualizó de manera correcta.' };
        } catch (error) {
            await this.logsService.enviarLog({ message: `Ocurrió un error al actualizar la dependencia: Error interno en el servidor.` }, "genericLog", token);
            handleKnownErrors(error, "Ocurrió un error al actualizar la dependencia")
        }
    }

    async updateDGeneral(_id: string, Direccion_General: string, token: string) {
        try {
            const result = await this.direcciongeneralModel.updateOne(
                { _id },
                { $set: { Direccion_General } },
            );
            if (!result) {
                await this.logsService.enviarLog({ message: `Ocurrio un error al actualizar la direccion general.` }, "genericLog", token);
                throw new BadRequestException('Ocurrio un error al actualizar la direccion general.');
            }
            await this.logsService.enviarLog({ message: `La dependencia se actualizó de manera correcta.` }, "genericLog", token);
            return {
                message: 'La direccion general se actualizó de manera correcta',
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: `Ocurrió un error al actualizar la direccion general: Error interno en el servidor.` }, "genericLog", token);
            handleKnownErrors(error, "Ocurrió un error al actualizar la direccion general")
        }
    }

    async updateDArea(_id: string, direccion_area: string, token: string) {
        try {
            const result = await this.direccionAreaModel.updateOne(
                { _id },
                { $set: { direccion_area } },
            );
            if (!result) {
                await this.logsService.enviarLog({ message: `Ocurrio un error al actualizar la direccion de área.` }, "genericLog", token);
                throw new BadRequestException(
                    'Ocurrio un error al actualizar la direccion de área.',
                );
            }
            await this.logsService.enviarLog({ message: `La direccion de área se actualizó de manera correcta.` }, "genericLog", token);
            return {
                message: 'La direccion de área se actualizó de manera correcta',
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: `Ocurrió un error al actualizar la direccion de área: Error interno en el servidor.` }, "genericLog", token);
            handleKnownErrors(error, "Ocurrió un error al actualizar la direccion de área")
        }
    }

    async updateMedios(_id: string, Medio: string, token: string) {
        try {
            const result = await this.medioModel.updateOne(
                { _id },
                { $set: { Medio } },
            );
            if (!result) {
                await this.logsService.enviarLog({ message: `Ocurrio un error al actualizar el medio de contacto.` }, "genericLog", token);
                throw new BadRequestException(
                    'Ocurrio un error al actualizar el medio de contacto',
                );
            }
            await this.logsService.enviarLog({ message: `El medio de contacto se actualizó de manera correcta.` }, "genericLog", token);
            return {
                message: 'El medio de contacto se actualizó de manera correcta',
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: `Ocurrió un error al actualizar el medio de contacto: Error interno en el servidor.` }, "genericLog", token);
        }
    }

    async updatePuesto(_id: string, Puesto: string, token: string) {
        try {
            const result = await this.puestoModel.updateOne(
                { _id },
                { $set: { Puesto } },
            );
            if (!result) {
                await this.logsService.enviarLog({ message: `Ocurrio un error al actualizar el puesto de trabajo.` }, "genericLog", token);
                throw new BadRequestException(
                    'Ocurrio un error al actualizar el puesto de trabajo.',
                );
            }
            await this.logsService.enviarLog({ message: `El puesto de trabajo se actualizó de manera correcta.` }, "genericLog", token);
            return {
                message: 'El puesto de trabajo se actualizó de manera correcta',
            };
        } catch (error) {
            await this.logsService.enviarLog({ message: `Ocurrió un error al actualizar el puesto de trabajo: Error interno en el servidor.` }, "genericLog", token);
            handleKnownErrors(error, "Ocurrió un error al actualizar el puesto de trabajo")
        }
    }

    async cambiarTicketCelula(_id: string, celula: string[]) {
        const formatedCelula = celula.map((c) => new Types.ObjectId(c))
        try {
            const result = await this.ticketModel.findOneAndUpdate({ _id }, { $set: { Celulas: formatedCelula } })
            if (!result) throw new BadRequestException("No se pudo actualizar el ticket");
            return true
        } catch (error) {
            handleKnownErrors(error, "No se pudo cambiar de célula el ticket")
        }
    }
}
