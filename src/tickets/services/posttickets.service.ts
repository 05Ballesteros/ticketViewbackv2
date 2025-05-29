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

interface UsuarioConRol {
    _id: Types.ObjectId;
    Rol: { _id: Types.ObjectId; Rol: string };
}

@Injectable()
export class PostTicketsService {
    constructor(
        private readonly getticketsService: GetTicketsService,
        @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
        @InjectModel(Estado.name) private readonly estadoModel: Model<Estado>,
        @InjectModel(Usuario.name) private readonly usuarioModel: Model<Usuario>,
    ) { }
    async crearTicket(dto: any, user: any): Promise<Ticket> {
        try {
            const asignado = await this.usuarioModel.findById(dto.Asignado_a).populate({ path: 'Rol', select: 'Rol Correo Nombre' }).lean<UsuarioConRol>().exec();
            const Estado = await this.getticketsService.getestadoTicket(asignado?.Rol.Rol);
            const Categorizacion = await this.getticketsService.getCategorizacion(new Types.ObjectId(dto.Subcategoria));
            const Fecha_limite = calcularFechaResolucion(dto.Tiempo);
            const Historia_ticket = await historicoCreacion(user, asignado);
            let data = {
                Cliente: new Types.ObjectId(dto.Cliente),
                Medio: new Types.ObjectId(dto.Medio),
                Asignado_a: new Types.ObjectId(dto.Asignado_a),
                Subcategoria: new Types.ObjectId(dto.Subcategoria),
                Descripcion: dto.Descripcion,
                NumeroRec_Oficio: dto.NumeroRec_Oficio,
                FIles: dto.Files,
                Creado_por: new Types.ObjectId(user.UserId),
                Estado: Estado?._id,
                Area: Categorizacion?.Equipo,
                Fecha_hora_creacion: obtenerFechaActual(),
                Fecha_limite_resolucion_SLA: Fecha_limite,
                Fecha_limite_respuesta_SLA: addHours(
                    obtenerFechaActual(),
                    dto.Tiempo
                ),
                Fecha_hora_ultima_modificacion: obtenerFechaActual(),
                Fecha_hora_cierre: fechaDefecto,
                Fecha_hora_resolucion: fechaDefecto,
                Fecha_hora_reabierto: fechaDefecto,
                Historia_ticket: Historia_ticket,
            };
            console.log(data);
            const tareaInstance = new this.ticketModel(data);
            return tareaInstance.save();
        } catch (error) {
            console.error("Error al crear el Ticket", error.message);
            throw new Error("Error interno del servidor.");
        }
    };
};
