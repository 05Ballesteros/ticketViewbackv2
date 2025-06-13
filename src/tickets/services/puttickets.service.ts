import {
    BadRequestException, Injectable, InternalServerErrorException, NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Estado } from 'src/schemas/estados.schema';
import { Ticket } from 'src/schemas/ticket.schema';
import { Usuario } from 'src/schemas/usuarios.schema';
import { GetTicketsService } from './gettickets.service';
import { calcularFechaResolucion } from 'src/common/utils/calcularFechaResolucion';
import { fechaDefecto, obtenerFechaActual } from 'src/common/utils/fechas';
import { addHours } from 'date-fns';
import { historicoAceptarSolucion, historicoAsignacion, historicoCreacion, historicoReabrir, historicoReasignacion, historicoRechazarSolucion, historicoRegresarMesa, historicoRegresarModerador, historicoRegresarResolutor, historicoResolver } from 'src/common/utils/historico';
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
        @InjectModel(Clientes.name) private readonly clienteModel: Model<Clientes>,
    ) { }
    async asginarTicket(ticketData: any, user: any, token: string, files: any, id: string): Promise<Ticket> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
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
            console.log("EStado", Estado);
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
            const propiedadesRol = await validarRol(rolAsignado, Moderador, ticketData);
            // Agregar dinámicamente las propiedades al objeto `updateData.$set`
            updateData.$set = {
                ...updateData.$set,
                ...propiedadesRol, // Combina las propiedades retornadas
            };
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
            //Se valida a quien se va enviar el correo de asignación
            const Usuario = await this.userService.getUsuario(
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
    async reasginarTicket(ticketData: any, user: any, token: string, files: any, id: string): Promise<Ticket> {
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
                    ticketData.Fecha_limite_respuesta_SLA
                ),
                Fecha_limite_resolucion_SLA: addHours(
                    obtenerFechaActual(),
                    ticketData.Fecha_limite_resolucion_SLA
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
            const rolReasignado = await this.userService.getRolAsignado(ticketData.Reasignado_a);
            if (!areaReasignado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Ocurrio un error al modificar el estado del ticket.");
            }
            // 2.- Obtener Estado para actualizar el ticket
            const Estado = await this.getticketsService.getEstado("ABIERTOS");
            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            };
            //3.- Agregar la historia
            const Historia_ticket = await historicoReasignacion(user, Usuario);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    ...reasignado,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    Estado,
                    vistoBueno: reasignado.vistoBueno,
                    areaReasignado,
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            if (rolReasignado !== "Usuario") {
                updateData.$set.Asignado_a = new Types.ObjectId(ticketData.Reasignado_a);
                updateData.$set.Reasignado_a = [];
            } else {
                updateData.$set.Reasignado_a = new Types.ObjectId(ticketData.Reasignado_a);
            }
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findOneAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true }
            );
            // 5.- Validar si hay archivos para guardar
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
            //Se valida a quien se va enviar el correo de asignación
            const cliente = await this.clienteService.getCliente(updatedTicket?.Cliente);
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
            const channel = "channel_reasignarTicket";
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
    async reabrirTicket(ticketData: any, user: any, token: string, files: any, id: string): Promise<Ticket> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            // Declarar variables
            let Estado: any | null = null;

            // 2.- Obtener datos necesarios para actualizar el ticket
            const areaAsignado = await this.userService.getareaAsignado(ticketData.Asignado_a);
            const rolAsignado = await this.userService.getRolAsignado(ticketData.Asignado_a);
            const RolModerador = await this.userService.getRolModerador("Moderador");
            const Moderador = await this.userService.getModeradorPorAreayRol(areaAsignado, RolModerador);
            // 3.- Validar cuál estado asignar al ticket
            Estado = await this.getticketsService.getEstado("REABIERTOS");
            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            };
            //4.- Agregar la historia
            const Historia_ticket = await historicoReabrir(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    ...ticketData,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    Estado: new Types.ObjectId(Estado),
                    areaAsignado,
                },
                $unset: {
                    PendingReason: "",
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                    Reabierto: { Fecha: obtenerFechaActual(), },
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
            const Usuario = await this.userService.getUsuario(ticketData.Asignado_a);
            const cliente = await this.clienteService.getCliente(updatedTicket.Cliente);
            //7.- Enviar correos
            let correoData = {
                idTicket: updatedTicket.Id,
                correoUsuario: Usuario?.Correo,
                correoCliente: cliente?.Correo,
                extensionCliente: cliente?.Extension,
                descripcionTicket: updatedTicket.Descripcion,
                nombreCliente: cliente?.Nombre,
                telefonoCliente: cliente?.Telefono,
                ubicacion: cliente?.Ubicacion,
                area: cliente?.direccion_area?.direccion_area,
            };
            const channel = "channel_reabrirTicket";
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
    async resolverTicket(ticketData: any, user: any, token: string, files: any, id: string): Promise<Ticket> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            // Declarar variables
            let Estado: any | null = null;
            // 1.- Obtener datos necesarios para actualizar el ticket
            if (user.rol === "Usuario" && ticketData.vistoBueno === true) {
                Estado = await this.getticketsService.getEstado("REVISION");
            } else {
                Estado = await this.getticketsService.getEstado("RESUELTOS");
                ticketData.Reasignado_a = user.userId;
            }
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            };
            //3.- Agregar la historia
            const Historia_ticket = await historicoResolver(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    ...ticketData,
                    Fecha_hora_resolucion: obtenerFechaActual(),
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    Estado: new Types.ObjectId(Estado),
                    Resuelto_por: user.userId,
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true }
            );
            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Ocurrió un error al resolver el ticket.");
            }
            // 5.- Incrementar el contador de tickets este codigó se va a mover a la ruta de cierre de ticket.
            // if (ticketData.vistoBueno !== true) {
            //     const result = incTicketsUsuario(updatedTicket.Fecha_hora_resolucion, updatedTicket.Fecha_limite_resolucion_SLA);
            //     const resultIncTicketsUsuario = await this.userService.incTickets(user, result);

            //     if (!resultIncTicketsUsuario) {
            //         console.log("Transacción abortada.");
            //         await session.abortTransaction();
            //         session.endSession();
            //         throw new BadRequestException("Ocurrió un error al actualizar el contador de tickets del usuario.");
            //     }
            // }
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
                    { new: true, upsert: true }
                );

                if (!updatedTicket) {
                    throw new BadRequestException("No se encontró el ticket para actualizar archivos.");
                }
            }
            //Se valida a quien se va enviar el correo de asignación
            return updatedTicket;
        } catch (error) {
            console.error("Error al crear el Ticket:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async aceptarResolucion(ticketData: any, user: any, id: string): Promise<Ticket> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            // Declarar variables
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado("RESUELTOS");
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            };
            //3.- Agregar la historia
            const Historia_ticket = await historicoAceptarSolucion(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    Estado,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    vistoBueno: false,
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true }
            );
            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Ocurrió un error al resolver el ticket.");
            }

            if (!updatedTicket) {
                throw new BadRequestException("No se encontró el ticket para actualizar archivos.");
            }
            //Se valida a quien se va enviar el correo de asignación
            return updatedTicket;
        } catch (error) {
            console.error("Error al aceptar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async rechazarResolucion(ticketData: any, user: any, files: any, token: string, id: string): Promise<Ticket> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            // Declarar variables
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado("ABIERTOS");
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            };
            //3.- Agregar la historia
            const Historia_ticket = await historicoRechazarSolucion(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    Estado,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                },
                $unset: {
                    Resuelto_por: "",
                    Respuesta_cierre_reasignado: "",
                    Fecha_hora_resolucion: "",
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true }
            );
            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Ocurrió un error al resolver el ticket.");
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
                    { new: true, upsert: true }
                );

                if (!updatedTicket) {
                    throw new BadRequestException("No se encontró el ticket para actualizar archivos.");
                }
            }
            //Se valida a quien se va enviar el correo de asignación
            return updatedTicket;
        } catch (error) {
            console.error("Error al rechazar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async regresarTicketMesa(ticketData: any, user: any, files: any, token: string, id: string): Promise<Ticket> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            console.log("ticketData", ticketData);
            // 1.- Consultar estado
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado("STANDBY");
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            };
            //3.- Consultar área de mesa
            const AreaTicket = await this.getticketsService.getAreaPorNombre("Mesa de Servicio");
            console.log("Mesa de servicio", AreaTicket);
            if (!AreaTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Área no encontrada.");
            };
            //3.- Agregar la historia
            const Historia_ticket = await historicoRegresarMesa(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: { Estado, AreaTicket, Fecha_hora_ultima_modificacion: obtenerFechaActual() },
                $unset: { Asignado_a: [], Reasignado_a: [] },
                $push: { Historia_ticket: { $each: Historia_ticket }, },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true }
            );
            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Ocurrió un error al resolver el ticket.");
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
                    { new: true, upsert: true }
                );

                if (!updatedTicket) {
                    throw new BadRequestException("No se encontró el ticket para actualizar archivos.");
                }
            }
            //Se valida a quien se va enviar el correo de asignación
            return updatedTicket;
        } catch (error) {
            console.error("Error al rechazar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async regresarTicketModerador(ticketData: any, user: any, files: any, token: string, id: string): Promise<Ticket> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            //1.-Consultar ticket
            const ticket = await this.getticketsService.getTicketsPor_Id(id);
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado("NUEVOS");
            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            };
            const AreaTicket = await this.getticketsService.getArea(ticket?.Asignado_a[0]._id);
            console.log("AreaTicket", AreaTicket);
            if (!AreaTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Área no encontrada.");
            };
            //3.- Agregar la historia
            const Historia_ticket = await historicoRegresarModerador(user, ticketData);
            const updateData: any = {
                $set: { Estado, AreaTicket, Fecha_hora_ultima_modificacion: obtenerFechaActual() },
                $unset: { Reasignado_a: [] },
                $push: { Historia_ticket: { $each: Historia_ticket }, },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true }
            );
            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Ocurrió un error al resolver el ticket.");
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
                    { new: true, upsert: true }
                );

                if (!updatedTicket) {
                    throw new BadRequestException("No se encontró el ticket para actualizar archivos.");
                }
            }
            //Se valida a quien se va enviar el correo de asignación
            return updatedTicket;
        } catch (error) {
            console.error("Error al rechazar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async regresarTicketResolutor(ticketData: any, user: any, files: any, token: string, id: string): Promise<Ticket> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            console.log("ticketData", ticketData);
            // 1.- Consultar estado
            let Estado: any | null = null;
            Estado = await this.getticketsService.getEstado("ABIERTOS");
            // 2.- Validar cuál estado asignar al ticket
            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            };
            //3.- Agregar la historia
            const Historia_ticket = await historicoRegresarResolutor(user, ticketData);
            // Crear datos para el ticket
            const updateData: any = {
                $set: { Estado, Fecha_hora_ultima_modificacion: obtenerFechaActual() },
                $push: { Historia_ticket: { $each: Historia_ticket }, },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true }
            );
            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Ocurrió un error al resolver el ticket.");
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
                    { new: true, upsert: true }
                );

                if (!updatedTicket) {
                    throw new BadRequestException("No se encontró el ticket para actualizar archivos.");
                }
            }
            //Falta lo del correo y crear el canal en emailservice.
            const Usuario = await this.userService.getUsuario(updatedTicket.Reasignado_a[0]._id.toString());
            //7.- Enviar correos
            const correoData = {
                idTicket: updatedTicket.Id,
                correoResolutor: Usuario?.Correo,
                Descripcion_respuesta_cliente: ticketData.Descripcion_respuesta_cliente,
            };

            console.log("Correo data", correoData);
            const channel = "channel_regresarTicketResolutor";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (correo) {
                console.log("Mensaje enviado al email service");
            }
            return updatedTicket;
        } catch (error) {
            console.error("Error al rechazar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };

    async marcarTicketPendiente(
        _id: string,
        user: { userId: string; nombre: string },
        cuerpoCorreo: string,
        emails_extra: string[],
        files: Express.Multer.File[],
        token: string,
    ): Promise<Ticket> {
        try {
            const resultEstado = await this.getticketsService.getIdEstadoTicket('PENDIENTES');

            if (!resultEstado) {
                throw new NotFoundException('No se encontro el estado del ticket.');
            }

            const { userId, nombre } = user;

            const result = await this.ticketModel.findOneAndUpdate(
                { _id },
                {
                    $set: { Estado: resultEstado._id },
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

            const cliente = await this.clienteModel.findById(result.Cliente).select('Nombre Correo');

            if (!cliente) {
                throw new NotFoundException('No se encontró la informacion del cliente.');
            }

            const formData = new FormData();

            const correoData = {
                details: cuerpoCorreo,
                idTicket: result.Id,
                destinatario: cliente.Correo,
                emails_extra,
            };

            formData.append('correoData', JSON.stringify(correoData));

            if (files.length > 0) {
                files.forEach((file) => {
                    const buffer = fs.readFileSync(file.path);
                    formData.append('files', buffer, file.originalname);
                });
            }

            const response = await this.correoService.enviarCorreoHTTP(formData, 'pendiente', _id, token);

            if (response.success) {
                return response.data;
            } else {
                console.error(
                    '⚠️    Hubo un problema al enviar el correo:',
                    response.data.message || response.data,
                );
            }
            throw new BadRequestException('Ocurrio un error al enviar al correo.');
        } catch (error) {
            console.error('Error al marcar el ticket como pendiente', error);
            throw new InternalServerErrorException('Error interno del servidor.');
        }
    }

    async contactarCliente(
        _id: string,
        user: { userId: string; nombre: string },
        cuerpoCorreo: string,
        emails_extra: string[],
        files: Express.Multer.File[],
        token: string,
    ): Promise<Ticket> {
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

            const cliente = await this.clienteModel.findById(result.Cliente).select('Nombre Correo');

            if (!cliente) {
                throw new NotFoundException('No se encontró la informacion del cliente.');
            }

            const formData = new FormData();

            const correoData = {
                details: cuerpoCorreo,
                idTicket: result.Id,
                destinatario: cliente.Correo,
                emails_extra,
            };

            formData.append('correoData', JSON.stringify(correoData));

            if (files.length > 0) {
                files.forEach((file) => {
                    const buffer = fs.readFileSync(file.path);
                    formData.append('files', buffer, file.originalname);
                });
            }

            const response = await this.correoService.enviarCorreoHTTP(
                formData,
                'contactoCliente',
                _id,
                token,
            );
            if (response.success) {
                return response.data;
            } else {
                console.error(
                    '⚠️    Hubo un problema al enviar el correo:',
                    response.data.message || response.data,
                );
            }
            throw new BadRequestException('Ocurrio un error al enviar al correo.');
        } catch (error) {
            console.error('Error al contactar al cliente', error);
            throw new InternalServerErrorException('Error interno del servidor.');
        }
    }
}; 
