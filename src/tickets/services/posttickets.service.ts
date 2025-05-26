import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Estado } from 'src/schemas/estados.schema';
import { Model, Types } from 'mongoose';
import { Ticket } from 'src/schemas/ticket.schema';

@Injectable()
export class PostTicketsService {
    constructor(
        @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
        @InjectModel(Estado.name) private readonly estadoModel: Model<Estado>,
    ) { }
    async findByEstado(estado: string, user: any): Promise<Ticket[] | null> {
        let result = [];
        const { rol, areas } = user;
        const userObjectId = new Types.ObjectId(user.userId);
        const estadoticket = await this.estadoModel.findOne({ Estado: { $regex: new RegExp(`^${estado}$`, 'i') } }).select('_id').exec();
        console.log(estadoticket);
        const ticketsSoloPorEstado = await this.ticketModel
            .find({ Estado: estadoticket?._id })
            .exec();
        console.log('Tickets filtrados sólo por Estado:', ticketsSoloPorEstado);
        if (rol === "Usuario") {
            result = await this.ticketModel.find({ Reasignado_a: userObjectId, Estado: estadoticket?._id });
        } else if (rol === "Moderador") {
            if (estado === "NUEVOS") {
                result = await this.ticketModel.find({ Asignado_a: userObjectId, Estado: estadoticket?._id });
            } else if (estado === "REVISION") {
                result = await this.ticketModel.find({ Asignado_a: userObjectId, Estado: estadoticket?._id, Area: areas });
            } else if (estado === "ABIERTOS") {
                result = await this.ticketModel.find({ Reasignado_a: userObjectId, Estado: estadoticket?._id });
            } else if (estado === "REABIERTOS") {
                result = await this.ticketModel.find({ Asignado_a: userObjectId, Estado: estadoticket?._id });
            } else {
                result = await this.ticketModel.find({ Asignado_a: userObjectId, Reasignado_a: userObjectId, Estado: estadoticket?._id });
            }
        } else {
            result = await this.ticketModel.find({ Estado: estadoticket?._id });
        }
        console.log("tickets", result);
        return result.length ? result : null;
    }
}
