import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { Estado } from 'src/schemas/estados.schema';
import { Ticket } from 'src/schemas/ticket.schema';
import { GetTicketsService } from './gettickets.service';
import { calcularFechaResolucion } from 'src/common/utils/calcularFechaResolucion';
import { fechaDefecto, obtenerFechaActual } from 'src/common/utils/fechas';
import { addHours } from 'date-fns';
import { historicoCreacion } from 'src/common/utils/historico';
import { guardarArchivos } from 'src/common/utils/guardarArchivos';
import { UserService } from './user.service';
import { ClienteService } from './cliente.service';
import { CorreoService } from './correos.service';
import { CounterService } from './counter.service';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Connection, ClientSession, Types } from 'mongoose';
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
import { generateNotification } from 'src/common/utils/generateNotificacion';

@Injectable()
export class PostTicketsService {
    constructor(
        private readonly getticketsService: GetTicketsService,
        private readonly userService: UserService,
        private readonly clienteService: ClienteService,
        private readonly correoService: CorreoService,
        private readonly counterService: CounterService,
        private readonly logsService: LogsService,
        private readonly filacorreosService: FilaCorreosService,
        private readonly redisService: RedisService,
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
        @InjectModel(Estado.name) private readonly estadoModel: Model<Estado>,
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
    async crearTicket(
        dto: any,
        user: any,
        token: string,
        files: any,
    ): Promise<{ message: string }> {
        const session: ClientSession = await this.connection.startSession();
        let committed = false; // ✅ Bandera

        session.startTransaction();
        try {
            //1.-Verificar el asignado
            const dtoAsignado = await this.userService.verificarAsignado(dto);
            //3.- Obtener información con la subcategoria
            const Categorizacion = await this.getticketsService.getCategorizacion(
                new Types.ObjectId(dto.Subcategoria),
            );
            //4.- Calcular las fechas
            const Fecha_limite = calcularFechaResolucion(dto.Tiempo);
            //5.- Obtencion del asignado
            const asignado = await this.userService.getUsuario(
                dtoAsignado.Asignado_a,
            );
            const rolAsignado = await this.userService.getRolAsignado(asignado?._id);
            //2.- Verificar estado segun el asignado
            const Estado = await this.getticketsService.getestadoTicket(rolAsignado);
            //6.- Se obtiene el cliente
            const cliente = await this.clienteService.getCliente(dto.Cliente);
            //5.- LLenado del hostorico
            const Historia_ticket = await historicoCreacion(user, asignado);
            const RolModerador = await this.userService.getRolModerador('Moderador');
            const Moderador = await this.userService.getModeradorPorAreayRol(
                asignado?.Area,
                RolModerador,
            );
            const Id = await this.counterService.getNextSequence('Id');
            let data = {
                Cliente: new Types.ObjectId(dto.Cliente),
                Medio: new Types.ObjectId(dto.Medio),
                Subcategoria: new Types.ObjectId(dto.Subcategoria),
                Descripcion: dto.Descripcion,
                NumeroRec_Oficio: dto.NumeroRec_Oficio,
                Creado_por: new Types.ObjectId(user.userId),
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
                AreaTicket: asignado?.Area,

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
            console.log('ticket guardado', savedTicket);
            if (!savedTicket) {
                throw new BadRequestException('No se creó el ticket.');
            }
            console.log('Ticket guardado correctamente');
            //7.- Se valida si el ticket se guardo correctamente y si hay archivos para guardar
            if (files.length > 0) {
                console.log('Ticket guardado:', savedTicket._id);
                const { data: uploadedFiles } = await guardarArchivos(token, files);
                if (uploadedFiles) {
                    console.log('Se guradaron los archivos');
                }
                const updatedTicket = await this.ticketModel.findByIdAndUpdate(
                    ticketInstance._id, // ✅ usa solo el ID aquí (puede ser string o ObjectId)
                    {
                        $push: {
                            Files: {
                                $each: uploadedFiles.map((file) => ({
                                    ...file,
                                    _id: new Types.ObjectId(),
                                })),
                            },
                        },
                    },
                    { new: true, upsert: false, session },
                );

                if (!updatedTicket) {
                    throw new BadRequestException(
                        'No se encontró el ticket para actualizar archivos.',
                    );
                }
                console.log('Archivos guardados correctamente');
                ticketInstance = updatedTicket;
            }
            //8.- Se genera el correoData
            const Usuario = await this.userService.getUsuario(
                (savedTicket.Reasignado_a && savedTicket.Reasignado_a.length > 0
                    ? savedTicket.Reasignado_a[0]
                    : savedTicket.Asignado_a[0]
                ).toString(),
            );
            const correoData = {
                Id: savedTicket.Id,
                destinatario: cliente?.Correo,
                emails_extra:
                    Usuario?.Correo === 'standby@standby.com'
                        ? <string[]>[]
                        : Usuario?.Correo,
                details: savedTicket.Descripcion,
                nombre: cliente?.Nombre,
                extension: cliente?.Extension,
                telefono: cliente?.Telefono,
                ubicacion: cliente?.Ubicacion,
                area: cliente?.direccion_area?.direccion_area,
                motivo: "",
            };
            //9.- Enviar correos
            const channel = 'channel_crearTicket';
            try {
                const correo = await this.correoService.enviarCorreo(
                    correoData,
                    channel,
                    token,
                );
                if (correo) {
                    console.log('Mensaje enviado al email service');
                    const savedlog = await this.logsService.enviarLog(correoData, "successCorreoTicket", token, "creado");
                }
            } catch (correoError) {
                const EstadoCorreo = await this.getticketsService.getEstado("PENDIENTES");
                console.warn("No se pudo enviar el correo. Se guardará en la fila. Error:", correoError.message);
                const savedlog = await this.logsService.enviarLog(correoData, "errorCorreo", token, "creado");
                // Agregar el motivo al objeto correoData
                correoData.motivo = "Error de envío: creación de ticket.";
                const savedCorreo = await this.filacorreosService.agregarCorreo(correoData, channel, EstadoCorreo as Types.ObjectId);
                await session.commitTransaction();
                committed = true;
                return {
                    message: `Ticket ${savedTicket.Id} creado correctamente, correo agregado a la fila.`,
                };
            }
            await session.commitTransaction();
            committed = true;

            await generateNotification(
                this.redisService,
                [
                    savedTicket.Asignado_a,
                ],
                savedTicket.Id,
                `Se ha creado el Ticket #${savedTicket.Id}.`,
                'Ticket Creado',
            );

            return {
                message: `Ticket ${savedTicket.Id} creado correctamente.`,
            };
        } catch (error) {
            await this.counterService.decrementSequence('Id');
            if (!committed) {
                await session.abortTransaction(); // ✅ Solo abortar si no se hizo commit
            }
            await this.logsService.enviarLog({ message: "❌ Error al crear el Ticket." }, "genericLog", token);
            throw new BadRequestException("❌ Error al crear el Ticket.");
        } finally {
            session.endSession(); // ✅ Siempre se cierra aquí, una sola vez
        }
    }

    async createAreas(Area: string, token: string) {
        try {
            const nuevaArea = await this.areaModel.create({ Area });
            if (!nuevaArea) {
                await this.logsService.enviarLog({ message: "❌ Ocurrió un error al crear el área." }, "genericLog", token);
                throw new BadRequestException('Ocurrio un error al crear el área');
            }
            await this.logsService.enviarLog({ message: " ✅ El área se creó de manera correcta." }, "genericLog", token);
            return { message: 'El área se creó de manera correcta' };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Ocurrió un error al crear el área: Error interno en el servidor." }, "genericLog", token);
            throw new InternalServerErrorException(
                'Ocurrió un error al crear el área: Error interno en el servidor.',
            );
        }
    }

    async createDependencias(Dependencia: string, token: string) {
        try {
            const nuevaDependencia = await this.dependenciaModel.create({
                Dependencia,
            });
            if (!nuevaDependencia) {
                await this.logsService.enviarLog({ message: "❌ Ocurrio un error al crear la dependencia." }, "genericLog", token);
                throw new BadRequestException('Ocurrio un error al crear la dependencia');
            }
            await this.logsService.enviarLog({ message: " ✅ La dependencia se creó de manera correcta." }, "genericLog", token);
            return { message: 'La dependencia se creó de manera correcta' };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Ocurrió un error al crear la dependencia: Error interno en el servidor." }, "genericLog", token);
            throw new InternalServerErrorException(
                'Ocurrió un error al crear la dependencia: Error interno en el servidor.',
            );
        }
    }

    async createDGenerales(Direccion_General: string, token: string) {
        try {
            const nuevaDGeneral = await this.direcciongeneralModel.create({
                Direccion_General,
            });
            if (!nuevaDGeneral) {
                await this.logsService.enviarLog({ message: "❌ Ocurrio un error al crear la Direccion General." }, "genericLog", token);
                throw new BadRequestException('Ocurrio un error al crear la Direccion General.');
            }
            await this.logsService.enviarLog({ message: "✅ La direccion general se creó de manera correcta." }, "genericLog", token);
            return { message: 'La direccion general se creó de manera correcta' };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Ocurrió un error al crear la direccion general: Error interno en el servidor." }, "genericLog", token);
            throw new InternalServerErrorException(
                'Ocurrió un error al crear la direccion general: Error interno en el servidor.',
            );
        }
    }

    async createDAreas(direccion_area: string, token: string) {
        try {
            const nuevaDArea = await this.direccionAreaModel.create({
                direccion_area,
            });
            if (!nuevaDArea) {
                await this.logsService.enviarLog({ message: "❌ Ocurrio un error al crear la Direccion de área." }, "genericLog", token);
                throw new BadRequestException('Ocurrio un error al crear la Direccion de área.');
            }
            await this.logsService.enviarLog({ message: "✅ La direccion de área se creó de manera correcta." }, "genericLog", token);
            return { message: 'La direccion de área se creó de manera correcta' };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Ocurrió un error al crear la direccion de área: Error interno en el servidor." }, "genericLog", token);
            throw new InternalServerErrorException(
                'Ocurrió un error al crear la direccion de área: Error interno en el servidor.',
            );
        }
    }

    async createMedios(Medio: string, token: string) {
        try {
            const medio = await this.medioModel.create({ Medio });
            if (!medio) {
                await this.logsService.enviarLog({ message: "❌ Ocurrio un error al crear el medio de contacto." }, "genericLog", token);
                throw new BadRequestException('Ocurrio un error al crear la Direccion de área.');
            }
            await this.logsService.enviarLog({ message: "✅ El medio de contacto se creó de manera correcta." }, "genericLog", token);
            return { message: 'El medio de contacto se creó de manera correcta' };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Ocurrió un error al crear el medio de contacto: Error interno en el servidor." }, "genericLog", token);
            throw new InternalServerErrorException(
                'Ocurrió un error al crear el medio de contacto: Error interno en el servidor.',
            );
        }
    }

    async createPuestos(Puesto: string, token: string) {
        try {
            const puesto = await this.puestoModel.create({ Puesto });
            if (!puesto) {
                await this.logsService.enviarLog({ message: "❌ Ocurrio un error al crear el puesto de trabajo." }, "genericLog", token);
                throw new BadRequestException('Ocurrio un error al crear la Direccion de área.');
            }
            await this.logsService.enviarLog({ message: "✅ El puesto de trabajo se creó de manera correcta." }, "genericLog", token);
            return { message: 'El puesto de trabajo se creó de manera correcta' };
        } catch (error) {
            await this.logsService.enviarLog({ message: "❌ Ocurrió un error al crear el puesto de trabajo: Error interno en el servidor." }, "genericLog", token);
            throw new InternalServerErrorException(
                'Ocurrió un error al crear el puesto de trabajo: Error interno en el servidor.',
            );
        }
    }
}
