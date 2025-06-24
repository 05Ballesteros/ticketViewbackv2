import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Estado } from 'src/schemas/estados.schema';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument } from 'src/schemas/ticket.schema';
import { Area } from 'src/schemas/area.schema';
import { Prioridad } from 'src/schemas/prioridades.schema';
import { Dependencia } from 'src/schemas/dependencia.schema';
import { Usuario } from 'src/schemas/usuarios.schema';
import { Rol } from 'src/schemas/roles.schema';
import { populateTickets } from 'src/common/utils/populate.tickets';
import { formatDates } from 'src/common/utils/formatDates';
import * as exceljs from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { Clientes } from 'src/schemas/cliente.schema';
import { populateCorreos } from 'src/common/utils/populateCorreos';
import { DireccionGeneral } from 'src/schemas/direccion_general.schema';
import { ClientePopulated, TicketPopulated } from 'src/common/Interfaces/interfacesparaconsulta';
import { TipoTicket } from 'src/schemas/tipoticket.schema';
import { Categoria } from 'src/schemas/categoria.schema';
import { Servicio } from 'src/schemas/servicio.schema';
import { Subcategoria } from 'src/schemas/subcategoria.schema';
import { DireccionArea } from 'src/schemas/direccionarea.schema';
import { Medio } from 'src/schemas/mediocontacto.schema';
import { Categorizacion } from 'src/schemas/categorizacion.schema';
import { sub } from 'date-fns';
import { th } from 'date-fns/locale';
@Injectable()
export class GetTicketsService {
    constructor(
        @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
        @InjectModel(Estado.name) private readonly estadoModel: Model<Estado>,
        @InjectModel(Prioridad.name) private readonly prioridadModel: Model<Prioridad>,
        @InjectModel(Usuario.name) private readonly usuarioModel: Model<Usuario>,
        @InjectModel(Rol.name) private readonly rolModel: Model<Rol>,
        @InjectModel(Dependencia.name) private readonly depedenciaModel: Model<Dependencia>,
        @InjectModel(Clientes.name) private readonly clienteModel: Model<Clientes>,
        @InjectModel(DireccionArea.name) private readonly direccionAreaModel: Model<DireccionArea>,
        @InjectModel(DireccionGeneral.name) private readonly direcciongeneralModel: Model<DireccionGeneral>,
        @InjectModel(Area.name) private readonly areaModel: Model<Area>,
        @InjectModel(Medio.name) private readonly medioModel: Model<Medio>,
        @InjectModel(Categorizacion.name) private readonly categorizacionModel: Model<Categorizacion>,
        @InjectModel(Subcategoria.name) private readonly subcategoriaModel: Model<Subcategoria>,
    ) { }

    async getTickets(estado: string, user: any): Promise<Ticket[] | null> {
        let result: TicketDocument[] = [];
        const { rol, areas } = user;
        const areasObjectId = areas.map((area) => new Types.ObjectId(area));
        const userObjectId = new Types.ObjectId(user.userId);
        const estadoticket = await this.estadoModel
            .findOne({ Estado: { $regex: new RegExp(`^${estado}$`, 'i') } })
            .select('_id')
            .exec();
        if (rol === 'Usuario') {
            result = await this.ticketModel
                .find({ Reasignado_a: userObjectId, Estado: estadoticket?._id })
                .populate('Reasignado_a')
                .exec();
        } else if (rol === 'Moderador') {
            if (estado === 'NUEVOS') {
                result = await this.ticketModel
                    .find({ Asignado_a: userObjectId, Estado: estadoticket?._id })
                    .exec();
            } else if (estado === 'REVISION') {
                result = await this.ticketModel.find({
                    Asignado_a: { $in: [userObjectId] },
                    Estado: estadoticket?._id,
                    Area: { $in: areasObjectId },
                });
            } else if (estado === 'ABIERTOS') {
                result = await this.ticketModel.find({
                    Reasignado_a: userObjectId,
                    Estado: estadoticket?._id,
                });
            } else if (estado === 'REABIERTOS') {
                result = await this.ticketModel.find({
                    Asignado_a: userObjectId,
                    Estado: estadoticket?._id,
                });
            } else {
                result = await this.ticketModel.find({
                    Asignado_a: userObjectId,
                    Reasignado_a: userObjectId,
                    Estado: estadoticket?._id,
                });
            }
        } else {
            result = await this.ticketModel.find({ Estado: estadoticket?._id }).populate('Creado_por');
        }
        if (result.length > 0) {
            const populatedTickets = await populateTickets(result);
            const formattedTickets = populatedTickets.map(formatDates);
            return formattedTickets;
        }
        return result;
    }

    async getTicket(id: string): Promise<Ticket[] | null> {
        try {
            const result = await this.ticketModel.find({ Id: id });

            if (!result) {
                throw new NotFoundException("No se encontro el ticket")
            }


            const populatedTickets = await populateTickets(result);
            const formattedTickets = populatedTickets.map(formatDates);
            return formattedTickets;

        } catch (error) {
            throw new BadRequestException()
        }
    }

    async getMedios() {
        try {
            const medios = await this.medioModel.find().sort({ Medio: 1 });
            const groupedMedios = medios.map((a) => ({
                label: a.Medio,
                value: a._id,
            }));
            return groupedMedios;
        } catch (error) {
            throw new InternalServerErrorException(
                'Ocurrió un error al obtener la información para los select de los medios',
            );
        }
    };


    async getReabrirFields() {
        try {
            const areas = await this.areaModel.find().exec();
            const prioridades = await this.prioridadModel.find().exec();

            if (!areas.length || !prioridades.length) {
                throw new Error("No se encontraron áreas o prioridades.");
            }

            const moderadores = await Promise.all(
                areas.map(async (area) => {
                    const resolutores = await this.usuarioModel
                        .find({
                            Area: area._id,
                            isActive: true,
                        })
                        .select("Nombre")
                        .exec();

                    return {
                        area: { area: area.Area, _id: area._id },
                        resolutores,
                    };
                })
            );

            if (!moderadores.length) {
                throw new Error("No se encontraron moderadores.");
            }

            console.log("Moderadores:", moderadores);
            return { prioridades, moderadores };
        } catch (error) {
            console.error("Error al obtener los campos de reabrir:", error.message);
            throw new Error("Error interno del servidor.");
        }
    };

    async getareasAsignacion() {
        try {
            const moderador = await this.rolModel.findOne({ Rol: "Moderador" }).exec();
            const administrador = await this.rolModel.findOne({ Rol: "Administrador" }).exec();
            const AREAS = await this.areaModel.find().exec();
            const prioridades = await this.prioridadModel.find().exec();
            if (!AREAS) {
                throw new Error("No se encontraron áreas.");
            }
            const AREASRESOLUTORES = await Promise.all(
                AREAS.map(async (area) => {
                    const RESOLUTOR = await this.usuarioModel.find({
                        isActive: true,
                        Area: area._id,
                        $or: [{ Rol: moderador?._id }, { Rol: administrador?._id }],
                    }).select("Nombre Correo");
                    return {
                        area: { area: area.Area, _id: area._id },
                        resolutores: RESOLUTOR,
                    };
                })
            );
            if (!AREASRESOLUTORES) {
                throw new Error("No se encontraron resolutores");
            }
            return { AREASRESOLUTORES, prioridades };
        } catch (error) {
            console.error("Error al obtener los campos de reabrir:", error.message);
            throw new Error("Error interno del servidor.");
        }
    };

    async getareasReasignacion(user: any) {
        const { areas } = user;
        try {
            const filter = areas ? { _id: { $in: Array.isArray(areas) ? areas : [areas] } } : {};
            const AREAS = await this.areaModel.find(filter).exec();
            const prioridades = await this.prioridadModel.find().exec();
            if (!AREAS || AREAS.length === 0) {
                throw new Error("No se encontraron áreas.");
            }

            const AREASRESOLUTORES = await Promise.all(
                AREAS.map(async (area) => {
                    const RESOLUTOR = await this.usuarioModel.find({ isActive: true, Area: area._id }).select('Nombre Correo').exec();
                    return {
                        area: { area: area.Area, _id: area._id },
                        resolutores: RESOLUTOR,
                    };
                })
            );

            if (!AREASRESOLUTORES || AREASRESOLUTORES.length === 0) {
                throw new Error("No se encontraron resolutores.");
            }

            return { AREASRESOLUTORES, prioridades };
        } catch (error) {
            console.error("Error al obtener los campos de reabrir:", error.message);
            throw new Error("Error interno del servidor.");
        }
    };

    async getAreas() {
        try {
            const AREAS = await this.areaModel.find().exec();
            if (!AREAS) {
                throw new Error("No se encontrarom areas.");
            }
            return { AREAS, tickets: [] };

        } catch (error) {
            console.error("Error al obtener los campos de reabrir:", error.message);
            throw new Error("Error interno del servidor.");
        }
    };

    async getArea(userId: any) {
        try {
            const result = await this.usuarioModel.findOne({ _id: userId }).lean();
            if (!result) {
                return false;
            }
            const areaUsuario = await this.usuarioModel.populate(result, [{ path: "Area" }]);
            if (!areaUsuario.Area || areaUsuario.Area.length === 0) {
                return false; // No hay áreas asociadas
            }
            return areaUsuario.Area.map((area: any) => area._id); // Devuelve un arreglo de _id
        } catch (error) {
            console.log("error", error);
            return false;
        }
    }



    async getTicketsPorArea(area: string): Promise<Ticket[]> {
        try {
            const [areaDoc] = await this.areaModel.find({ Area: area }).select("_id").exec();
            const Area = areaDoc._id;
            const tickets = await this.ticketModel.find({ Area }).exec();
            const populatedTickets = await populateTickets(tickets);
            const formattedTickets = populatedTickets.map(formatDates);
            return formattedTickets;
        } catch (error) {
            throw new HttpException(
                { message: 'Error al buscar los tickets.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    };

    async getTicketsResolutor(userid: string) {
        const tickets = await this.ticketModel.find({ Reasignado_a: new Types.ObjectId(userid) }).exec();
        if (!tickets.length) {
            throw new Error("No se encontraron tickets de este resolutor.");
        }

        const populatedTickets = await populateTickets(tickets);
        const formattedTickets = populatedTickets.map(formatDates);
        return formattedTickets;
    };
    //Falta corregirlo.
    async exportTicketsToExcel(): Promise<string> {
        try {
            // 1️⃣ Obtener los tickets con populate
            const tickets = await this.ticketModel
                .find()
                .populate([
                    {
                        path: 'Subcategoria',
                        populate: [{ path: 'Equipo', select: 'Area _id' }],
                    },
                    { path: 'Estado' },
                    {
                        path: 'Asignado_a',
                        select: 'Nombre Correo _id',
                        populate: [{ path: 'Area', select: 'Area _id' }],
                    },
                    {
                        path: 'Reasignado_a',
                        select: 'Nombre Correo _id',
                        populate: [{ path: 'Area', select: 'Area _id' }],
                    },
                    {
                        path: 'Resuelto_por',
                        select: 'Nombre Correo _id',
                        populate: [{ path: 'Area', select: 'Area _id' }],
                    },
                    {
                        path: 'Cliente',
                        select: 'Nombre Correo Telefono Ubicacion _id',
                        populate: [
                            { path: 'Direccion_General', select: 'Direccion_General _id' },
                            { path: 'direccion_area', select: 'direccion_area _id' },
                        ],
                    },
                ])
                .exec();
            console.log(tickets);

            if (!tickets.length) {
                throw new HttpException('No hay tickets disponibles.', HttpStatus.NOT_FOUND);
            }

            // 2️⃣ Crear un nuevo libro de Excel
            const workbook = new exceljs.Workbook();
            const worksheet = workbook.addWorksheet('Tickets');

            // 3️⃣ Definir las columnas
            worksheet.columns = [
                { header: 'ID', key: 'Id', width: 25 },
                { header: 'Fecha Creacion', key: 'Fecha_creacion', width: 25 },
                { header: 'Fecha Cierre', key: 'Fecha_hora_cierre', width: 25 },
                { header: "Oficio recepcion", key: "NumeroRec_Oficio", width: 25 },
                { header: "Oficio cierre", key: "Numero_Oficio", width: 25 },
                { header: "Estado", key: "Estado", width: 25 },
                { header: "Area", key: "Area", width: 25 },
                { header: "Tipo incidencia", key: "Tipo_incidencia", width: 25 },
                { header: "Servicio", key: "Servicio", width: 25 },
                { header: "Categoría", key: "Categoria", width: 25 },
                { header: "Subcategoría", key: "Subcategoria", width: 25 },
                { header: "Descripcion", key: "Descripcion", width: 25 },
                { header: "Prioridad", key: "Prioridad", width: 25 },
                { header: "Fecha limite de resolucion", key: "Fecha_lim_res", width: 25 },
                { header: "Creado por", key: "Creado_por", width: 25 },
                { header: "Area creado por", key: "Area_creado_por", width: 25 },
                { header: "Asignado a", key: "Asignado_a", width: 25 },
                { header: "Area asignado", key: "Area_asignado", width: 25 },
                { header: "Reasignado a", key: "Reasignado_a", width: 25 },
                { header: "Area reasignado", key: "Area_reasignado_a", width: 25 },
                {
                    header: "Respuesta cierre reasignado",
                    key: "Respuesta_cierre_reasignado",
                    width: 25,
                },
                { header: "Resuelto_por", key: "Resuelto_por", width: 25 },
                { header: "Area resuelto por", key: "Area_resuelto_por", width: 25 },
                { header: "Cliente", key: "Cliente", width: 25 },
                { header: "Correo cliente", key: "Correo_cliente", width: 25 },
                { header: "Telefono cliente", key: "Telefono_cliente", width: 25 },
                //{ header: "Extension cliente", key: "Extension_cliente", width: 25 },
                { header: "Ubicacion cliente", key: "Ubicacion_cliente", width: 25 },
                //{ header: "Dependencia cliente", key: "Dependencia_cliente", width: 25 },
                {
                    header: "Direccion general cliente",
                    key: "DireccionG_cliente",
                    width: 25,
                },
                {
                    header: "Direccion de area cliente",
                    key: "DireccionA_cliente",
                    width: 25,
                },
            ];

            // 4️⃣ Agregar datos a las filas
            tickets.forEach((ticket) => {
                worksheet.addRow({
                    Id: ticket.Id || "",
                    Fecha_creacion: ticket.Fecha_hora_creacion || "",
                    Fecha_hora_cierre: ticket.Fecha_hora_cierre || "",
                    NumeroRec_Oficio: ticket.NumeroRec_Oficio || "",
                    Numero_Oficio: ticket.Numero_Oficio || "",
                    Estado: ticket.Estado || "",
                    //Area: ticket.Subcategoria?.Equipo.Area || "",
                    //Tipo_incidencia: ticket.Subcategoria?.Tipo || "",
                    //Servicio: ticket.Subcategoria?.Servicio || "",
                    //Categoria: categoria,
                    //Subcategoria: ticket.Subcategoria?.Subcategoria || "",
                    Descripcion: ticket.Descripcion || "",
                    //Prioridad: ticket.Subcategoria?.Descripcion_prioridad || "",
                    Fecha_lim_res: ticket.Fecha_limite_resolucion_SLA || "",
                    //Creado_por: ticket.Creado_por?.Nombre || "",
                    //Area_creado_por: Array.isArray(ticket.Creado_por?.Area)
                    // ? ticket.Creado_por.Area[0]?.Area
                    // : "",
                    //Asignado_a: ticket.Asignado_a?.Nombre || "",
                    //Area_asignado: Array.isArray(ticket.Asignado_a?.Area)
                    //  ? ticket.Asignado_a?.Area[0]?.Area
                    //: "",
                    // Reasignado_a: ticket.Reasignado_a?.Nombre || "",
                    // Area_reasignado_a: Array.isArray(ticket.Reasignado_a?.Area)
                    //     ? ticket.Reasignado_a?.Area[0]?.Area
                    //     : "",
                    // Respuesta_cierre_reasignado: ticket.Respuesta_cierre_reasignado || "",
                    // Resuelto_por: ticket.Resuelto_por?.Nombre || "",
                    // Area_resuelto_por: Array.isArray(ticket.Resuelto_por?.Area)
                    //     ? ticket.Resuelto_por?.Area[0]?.Area
                    //     : "",
                    // Cliente: ticket.Cliente?.Nombre || "",
                    // Correo_cliente: ticket.Cliente?.Correo || "",
                    // Telefono_cliente: ticket.Cliente?.Telefono || "",
                    // //Extension_cliente: ticket.Cliente?.Extension || "",
                    // Ubicacion_cliente: ticket.Cliente?.Ubicacion || "",
                    // //Dependencia_cliente: ticket.Cliente?.Dependencia?.Dependencia || "",
                    // DireccionG_cliente:
                    //     ticket.Cliente?.Direccion_General?.Direccion_General || "",
                    // DireccionA_cliente:
                    //     ticket.Cliente?.direccion_area?.direccion_area || "",
                });
            });


            // 5️⃣ Guardar el archivo Excel temporalmente
            const uploadPath = path.join(__dirname, '..', 'temp');
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            const filePath = `${uploadPath}/tickets_${Date.now()}.xlsx`;
            await workbook.xlsx.writeFile(filePath);

            return filePath; // Devuelve la ruta del archivo
        } catch (error) {
            throw new HttpException(
                { message: 'Error al generar el Excel.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    };

    async getDependenciasCLientes() {
        const dependencias = await this.depedenciaModel.find().exec();
        const DEPENDENCIASCLIENTES = await Promise.all(
            dependencias.map(async (dependencia) => {
                const clientes = await this.clienteModel.find({
                    Dependencia: dependencia._id
                }).exec();
                return {
                    Dependencia: {
                        Dependencia: dependencia.Dependencia,
                        _id: dependencia._id,
                    },
                    clientes,
                };
            })
        );

        return DEPENDENCIASCLIENTES;
    };

    async getCorreos(id: string) {
        const ticket = await this.ticketModel.findOne({ _id: new Types.ObjectId(id) })
            .populate([
                { path: 'Asignado_a', select: 'Nombre Correo Coordinacion Area _id' },
                { path: 'Cliente', select: 'Correo -_id' }
            ])
            .exec() as TicketPopulated | null;

        if (!ticket) {
            throw new Error('No se encontraron correos.');
        }

        if (typeof ticket.Cliente === 'object' && 'Correo' in ticket.Cliente) {
            const correoCliente = (ticket.Cliente as ClientePopulated).Correo;

            return {
                correoCliente,
                correoMesa: process.env.CORREO_MESA || 'centroservicio@ipejal.gob.mx',
            };
        } else {
            throw new Error('Cliente no está poblado correctamente');
        }
    };

    async getInfoSelects() {
        try {
            const [AREAS_, MEDIO_, CATEGORIZACION_] = await Promise.all([
                this.areaModel.find().sort({ Area: 1 }).exec(),
                this.medioModel.find().sort({ Medio: 1 }).exec(),
                this.categorizacionModel.find().sort({ Subcategoria: 1 }).populate({ path: 'Equipo' }).lean().exec(),
            ]);

            const resolutores = await Promise.all(
                AREAS_.map(async (area) => {
                    const resolutor = await this.usuarioModel.find({
                        Area: area._id,
                        isActive: true,
                    })
                        .select("Nombre Correo")
                        .sort({ Nombre: "asc" });
                    return {
                        area: { area: area.Area, _id: area._id },
                        resolutores: resolutor,
                    };
                })
            );
            const groupedResolutores = resolutores.map((r) => ({
                label: r.area.area,
                options: r.resolutores.map((rs) => ({ value: rs._id, label: rs.Nombre })),
            }));

            const formatedMedio = MEDIO_.map((f) => ({ value: f._id, label: f.Medio }));
            const formatedSubcategorias = CATEGORIZACION_.map((f) => ({ ...f, value: f._id, label: f.Subcategoria }));

            return {
                resolutores: groupedResolutores,
                medios: formatedMedio,
                categorizacion: formatedSubcategorias,
            };
        } catch (error) {
            return false;
        }


    };

    async getTicketsPorId(id: string) {
        const tickets = await this.ticketModel.find({ Id: id }).exec();
        if (!tickets.length) {
            throw new Error("No se encontro el Ticket.");
        }
        const populatedTickets = await populateTickets(tickets);
        const formattedTickets = populatedTickets.map(formatDates);
        return formattedTickets;
    };

    async getTicketsPor_Id(_id: string) {
        const tickets = await this.ticketModel.findOne({ _id: _id }).populate([
            { path: 'Asignado_a Reasignado_a Cliente Creado_por' },
            { path: 'Area', select: 'Area' },
            { path: 'Estado', select: 'Estado' },
            { path: 'Medio', select: 'Medio' },
            { path: 'Subcategoria' },]).exec();
        return tickets;
    };

    //Obtiene todos los datos de la categorización por medio de la subcategoria en string
    async getCategorizacion(Subcategoria: any) {
        const Categorizacion = await this.categorizacionModel.findById({ _id: Subcategoria });
        return Categorizacion;
    };

    //Esta función si se utiliza
    async getestadoTicket(Rol: string) {
        try {
            let estado;

            if (Rol === "Usuario") {
                estado = await this.estadoModel.findOne({ Estado: "ABIERTOS" }).select("_id");
            } else if (Rol === "Moderador") {
                estado = await this.estadoModel.findOne({ Estado: "NUEVOS" }).select("_id");
            } else {
                estado = await this.estadoModel.findOne({ Estado: "STANDBY" }).select("_id");
            }
            return estado;
        } catch (error) {
            throw new BadRequestException("No se encontró el estado.");
        }
    };

    async getEstado(estado: any) {
        try {
            const estadoticket = await this.estadoModel.findOne({ Estado: estado }).select("_id");
            return estadoticket?._id;
        } catch (error) {
            throw new BadRequestException("No se encontró el estado.");
        }
    };

    async getCalendario(areas: string[], userId: string) {
        const sanitizedAreas = areas.map((a) => new Types.ObjectId(a))
        try {
            const result = await this.ticketModel.find({
                $and: [
                    { $or: [{ Asignado_a: new Types.ObjectId(userId) }, { Reasignado_a: new Types.ObjectId(userId) }] },
                    { $or: [{ Area: { $in: sanitizedAreas } }, { AreaTicket: { $in: sanitizedAreas } }] }
                ]
            }).select("Id Fecha_limite_resolucion_SLA Subcategoria Descripcion Cliente");

            const populatedResult = await this.ticketModel.populate(result, [
                { path: "Subcategoria", select: "Descripcion_prioridad -_id" },
                { path: "Cliente", select: "Nombre Correo -_id" },
            ]);
            return populatedResult
        } catch (error) {
            console.log(error);
            throw new BadRequestException("No se encontraron tickets");
        }
    };

    async getPerfil(userId: string) {
        try {
            const result = await this.usuarioModel.findOne({ _id: new Types.ObjectId(userId) }, { Password: 0, Rol: 0 });

            const populatedResult = await this.ticketModel.populate(result, [
                { path: "Area", select: "-_id" },
                { path: "Dependencia", select: "-_id" },
                { path: "Direccion_General", select: "-_id" },
            ]);
            return populatedResult
        } catch (error) {
            throw new BadRequestException("No se encontraro el usuario. Error interno en el servidor.");
        }
    };

    async getAreaPorNombre(nombre: string) {
        try {
            const Area = await this.areaModel.findOne({ Area: nombre });
            return Area;
        } catch (error) {
            throw new BadRequestException("No se encontraro el área. Error interno en el servidor.");
        }
    };

    async getIdEstadoTicket(estado: string) {
        try {
            const result = await this.estadoModel.findOne({ Estado: estado }).select('_id');
            return result;
        } catch (error) {
            throw new NotFoundException('No se encontró el estado.');
        }
    }
};
