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
import { historicoAceptarSolucion, historicoAsignacion, historicoCerrar, historicoCreacion, historicoEditar, historicoNota, historicoOficio, historicoPendingReason, historicoReabrir, historicoReasignacion, historicoRechazarSolucion, historicoRegresarMesa, historicoRegresarModerador, historicoRegresarResolutor, historicoResolver } from 'src/common/utils/historico';
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
    async asginarTicket(ticketData: any, user: any, token: string, files: any, id: string): Promise<{ message: string; }> {
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
            //4.- Agregar la historia
            const Historia_ticket = await historicoAsignacion(user, ticketData,);
            // Crear datos para el ticket
            const { Cliente, ...filteredTicketData } = ticketData; //Se hace para excluir el cliente y que no se guarde como string
            const updateData: any = {
                $set: {
                    ...filteredTicketData,
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
                Id: updatedTicket.Id,
                destinatario: Usuario?.Correo,
                details: updatedTicket.Descripcion,
                nombre: cliente?.Nombre,
                extension: cliente?.Extension,
                telefono: cliente?.Telefono,
                ubicacion: cliente?.Ubicacion,
                area: cliente?.direccion_area?.direccion_area,
            };
            const channel = "channel_asignarTicket";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (correo) {
                console.log("Mensaje enviado al email service");
            }

            return {
                message: `Ticket ${updatedTicket.Id} asignado correctamente.`,
            };
        } catch (error) {
            console.error("Error al crear el Ticket:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async reasginarTicket(ticketData: any, user: any, token: string, files: any, id: string): Promise<{ message: string; }> {
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
            //2.- Agregar la historia
            const { Cliente, Nota, ...filteredTicketData } = reasignado; //Se hace para excluir el cliente y que no se guarde como string
            console.log("filteredTicketData", filteredTicketData);
            const Historia_ticket = await historicoReasignacion(user, Usuario);
            const Nota_ticket = await historicoNota(user, reasignado);
            console.log(" historico y nota", Historia_ticket, Nota_ticket);
            // Crear datos para el ticket
            const updateData: any = {
                $set: {
                    ...filteredTicketData,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    vistoBueno: reasignado.vistoBueno,
                    areaReasignado,
                },
                $push: {
                    Historia_ticket: {
                        $each: [...Historia_ticket, ...Nota_ticket]
                    }
                },
            };

            // 3.- Obtener Estado para actualizar el ticket
            if (rolReasignado === "Moderador") {
                updateData.$set.Estado = await this.getticketsService.getEstado("NUEVOS");
                updateData.$set.Asignado_a = new Types.ObjectId(ticketData.Reasignado_a);
                updateData.$set.Reasignado_a = [];
            } else {
                updateData.$set.Estado = await this.getticketsService.getEstado("ABIERTOS");
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
                Id: updatedTicket.Id,
                destinatario: Usuario?.Correo,
                extension: cliente?.Extension,
                details: updatedTicket.Descripcion,
                nombre: cliente?.Nombre,
                telefono: cliente?.Telefono,
                ubicacion: cliente?.Ubicacion,
                area: cliente?.direccion_area?.direccion_area,
            };
            const channel = "channel_reasignarTicket";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (correo) {
                console.log("Mensaje enviado al email service");
            }
            if (updatedTicket) {
                console.log("Ticket reasignado correctamente.");
            }
            return {
                message: `Ticket ${updatedTicket.Id} reasignado correctamente.`,
            };
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
                Id: updatedTicket.Id,
                destinatario: cliente?.Correo,
                emails_extra: Usuario?.Correo,
                details: updatedTicket.Descripcion,
                nombre: cliente?.Nombre,
                extension: cliente?.Extension,
                telefono: cliente?.Telefono,
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
    async resolverTicket(ticketData: any, user: any, token: string, files: any, id: string): Promise<{ message: string; }> {
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
                    Resuelto_por: new Types.ObjectId(user.userId),
                },
                $push: {
                    Historia_ticket: { $each: Historia_ticket },
                },
            };
            //4.- Actualizar el ticket
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true }
            );
            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Ocurrió un error al resolver el ticket.");
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
                    { new: true, upsert: true }
                );

                if (!updatedTicket) {
                    throw new BadRequestException("No se encontró el ticket para actualizar archivos.");
                }
            }
            //Se valida a quien se va enviar el correo de asignación
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            console.error("Error al resolver el Ticket:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async aceptarResolucion(ticketData: any, user: any, id: string): Promise<{ message: string; }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        console.log("Esto llega", ticketData);
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
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            console.error("Error al aceptar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async rechazarResolucion(ticketData: any, user: any, files: any, token: string, id: string): Promise<{ message: string; }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        console.log("Esto llega", ticketData);
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
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            console.error("Error al rechazar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async regresarTicketMesa(ticketData: any, user: any, files: any, token: string, id: string): Promise<{ message: string; }> {
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
                $set: {
                    Estado, AreaTicket, Fecha_hora_ultima_modificacion: obtenerFechaActual(), standby: true,
                    Asignado_a: await this.userService.getUsuarioMesa("standby"),
                },
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
            let correoData = {
                Id: updatedTicket.Id,
                details: ticketData.descripcion_retorno,
            };
            const channel = "channel_regresarTicketMesa";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (correo) {
                console.log("Mensaje enviado al email service: channel_regresarTicketMesa");
            }
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            console.error("Error al rechazar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async regresarTicketModerador(ticketData: any, user: any, files: any, token: string, id: string): Promise<{ message: string; }> {
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
                $set: { Estado, AreaTicket, Fecha_hora_ultima_modificacion: obtenerFechaActual(), vistoBueno: false },
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
            let correoData = {
                Id: updatedTicket.Id,
                destinatario: (await this.userService.getCorreoUsuario(updatedTicket.Asignado_a[0])), //Moderador
                details: ticketData.descripcion_retorno,
            };
            const channel = "channel_regresarTicketModerador";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (correo) {
                console.log("Mensaje enviado al email service: channel_regresarTicketModerador");
            }
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            console.error("Error al rechazar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async regresarTicketResolutor(ticketData: any, user: any, files: any, token: string, id: string): Promise<{ message: string; }> {
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
                Id: updatedTicket.Id,
                destinatario: Usuario?.Correo,
                details: ticketData.Descripcion_respuesta_cliente,
            };

            console.log("Correo data", correoData);
            const channel = "channel_regresarTicketResolutor";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (correo) {
                console.log("Mensaje enviado al email service");
            }
            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };
        } catch (error) {
            console.error("Error al rechazar solución:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async cerrarTicket(ticketData: any, user: any, token: string, files: any, id: string): Promise<{ message: string; }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            // Declarar variables
            let Estado: any | null = null;
            // 1.- Obtener el estado CERRADOS
            Estado = await this.getticketsService.getEstado("CERRADOS");
            if (!Estado) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Estado no encontrado.");
            };
            //2.- Agregar la historia
            const Historia_ticket = await historicoCerrar(user, ticketData);
            //3.- Crear datos para el ticket
            const updateData: any = {
                $set: {
                    Descripcion_cierre: ticketData.Descripcion_cierre,
                    Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                    Cerrado_por: new Types.ObjectId(user.userId),
                    Estado: new Types.ObjectId(Estado),
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
                return {
                    message: `No fue posible cerrar el ticket.`,
                };
            } else {
                const result = incTicketsUsuario(updatedTicket.Fecha_hora_resolucion, updatedTicket.Fecha_limite_resolucion_SLA);
                const resultIncTicketsUsuario = await this.userService.incTickets(user, result);

                if (!resultIncTicketsUsuario) {
                    console.log("Transacción abortada.");
                    await session.abortTransaction();
                    session.endSession();
                    throw new BadRequestException("Ocurrió un error al actualizar el contador de tickets del usuario.");
                }
            };
            const cliente = await this.clienteService.getCliente(updatedTicket.Cliente);
            //7.- Enviar correos
            const formData = new FormData();

            const correoData = {
                Id: updatedTicket.Id,
                destinatario: cliente.Correo,
                details: ticketData.Descripcion_cierre,
            };

            formData.append('correoData', JSON.stringify(correoData));

            if (files.length > 0) {
                files.forEach((file) => {
                    const buffer = fs.readFileSync(file.path);
                    formData.append('files', buffer, file.originalname);
                });
            }
            const response = await this.correoService.enviarCorreoHTTP(formData, 'cerrar', updateData._id, token);
            if (response.success) {
                return {
                    message: response.message,
                };
            } else {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                throw new BadRequestException("Ocurrió un error al notificar al usuario.");
            }
        } catch (error) {
            console.error("Error al crear el Ticket:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async agregarNota(ticketData: any, user: any, files: any, id: string, token: string): Promise<{ message: string; }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        let destinatario = "";
        let emails_extra: string[] = [];
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
                { new: true, upsert: false } // ⛔ Evita upsert si el documento debería existir
            );

            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                return { message: `No fue posible agregar la Nota.` };
            }

            if (user.rol === "Usuario") {
                destinatario = (await this.userService.getCorreoUsuario(updatedTicket.Asignado_a[0])) ?? ""; //Moderador
                //const PM = await this.userService.getCorreoUsuario(updatedTicket.Reasignado_a[0]); //PM 
                // if (PM) {
                //     emails_extra.push(PM);
                // }
            } else if (user.rol === "Moderador") {
                destinatario = (await this.userService.getCorreoUsuario(updatedTicket.Reasignado_a[0])) ?? ""; //Resolutor
                //const PM = await this.userService.getCorreoUsuario(updatedTicket.Reasignado_a[0]); //PM 
                // if (PM) {
                //     emails_extra.push(PM);
                // }
            } else if (user.rol === "Auditor") {
                destinatario = (await this.userService.getCorreoUsuario(updatedTicket.Asignado_a[0])) ?? ""; //Moderador
                const Resolutor = await this.userService.getCorreoUsuario(updatedTicket.Reasignado_a[0]); //Resolutor
                if (Resolutor) {
                    emails_extra.push(Resolutor);
                }
            } else {
                destinatario = (await this.userService.getCorreoUsuario(updatedTicket.Asignado_a[0])) ?? ""; //Moderador
                const Resolutor = await this.userService.getCorreoUsuario(updatedTicket.Reasignado_a[0]); //Resolutor
                //const PM = await this.userService.getCorreoUsuario(updatedTicket.Reasignado_a[0]); //PM 
                if (Resolutor) {
                    emails_extra.push(Resolutor);
                }
            }

            const correoData = {
                Id: updatedTicket.Id,
                destinatario,
                emails_extra,
                details: ticketData.Nota,
            };

            if (!destinatario && emails_extra.length < 1) {
                console.warn("No hay destinatarios válidos para enviar el correo.");
                await session.abortTransaction();
                session.endSession();
                return { message: `Nota agregada correctamente al Ticket ${updatedTicket.Id}.` };
            }
            console.log("CorreData", correoData);
            const channel = "channel_notas";
            const correo = await this.correoService.enviarCorreo(correoData, channel, token);
            if (!correo) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                return { message: `No fue posible agregar la Nota.` };
            } else {
                console.log("Mensaje enviado al email service");
                return { message: `Nota agregada correctamente al Ticket ${updatedTicket.Id}.` };
            }

        } catch (error) {
            console.error("Error al crear el Ticket:", error.message);
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
                Id: result.Id,
                destinatario: cliente.Correo,
                emails_extra,
                details: cuerpoCorreo,
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
    };
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
                Id: result.Id,
                destinatario: cliente.Correo,
                emails_extra,
                details: cuerpoCorreo,
            };
            console.log("CorreoData", correoData);
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
    };
    async PendingReason(ticketData: any, user: any, id: string): Promise<{ message: string; }> {
        const session: ClientSession = await this.connection.startSession();
        session.startTransaction();
        try {
            console.log("ticketData", ticketData);
            const Historia_ticket = await historicoPendingReason(user, ticketData);
            const updateData: any = {
                $set: { PendingReason: ticketData.PendingReason },
                $push: { Historia_ticket: { $each: Historia_ticket } },
            };

            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                { _id: id },
                updateData,
                { new: true, upsert: true }
            );
            console.log(updatedTicket);
            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                return { message: `No fue posible agregar la Nota.` };
            } else {
                return { message: `PendingReason agregada correctamente al Ticket ${updatedTicket.Id}.` };
            }

        } catch (error) {
            console.error("Error al crear el Ticket:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async editarTicket(ticketData: any, user: any, id: string, files: any, token: string): Promise<{ message: string; }> {
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
                { new: true, upsert: true }
            );
            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
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
                    { new: true, upsert: true }
                );

                if (!updatedTicket) {
                    throw new BadRequestException("No se encontró el ticket para actualizar archivos.");
                }
            }

            return {
                message: `Ticket ${updatedTicket.Id} guardado correctamente.`,
            };

        } catch (error) {
            console.error("Error al crear el Ticket:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
    async agregarOficio(ticketData: any, user: any, files: any, id: string, token: string): Promise<{ message: string; }> {
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
                { new: true, upsert: true }
            );

            if (!updatedTicket) {
                console.log("Transacción abortada.");
                await session.abortTransaction();
                session.endSession();
                return { message: `No fue posible agregar el oficio.` };
            } else {
                return { message: `Oficio de cierre agregado correctamente al Ticket ${updatedTicket.Id}.` };
            }

        } catch (error) {
            console.error("Error al crear el Ticket:", error.message);
            throw new BadRequestException("Error interno del servidor.");
        }
    };
}; 
