import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clientes } from 'src/schemas/cliente.schema';
import { ClienteConPopulates, DireccionArea } from 'src/common/Interfaces/interfacesparaconsulta';
import { Logs } from 'src/schemas/log.schema';
import { format } from 'date-fns';
import { Filacorreos } from 'src/schemas/filacorreos.schema';

export interface FilaCorreos {
    Id: number;
    destinatario: string;
    emails_extra: string[];
    details: string;
    nombre: string;
    telefono: string;
    extension: string;
    ubicacion: string;
    area: string;
    channel: string;
    Fecha_hora_agregado: Date;
}

@Injectable()
export class FilaCorreosService {
    constructor(
        @InjectModel(Filacorreos.name) private readonly filacorreosModel: Model<Filacorreos>,
    ) { }

    async agregarCorreo(correoData: any, channel: string, Estado: Types.ObjectId) {
        console.log("Message", correoData);
        try {
            const correo = new this.filacorreosModel({
                ...correoData,
                channel: channel,
                Fecha_hora_agregado: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
                Estado: Estado
            });
            await correo.save();
        } catch (error) {
            throw new BadRequestException("Error al capturar logs.");
        }
    }

    async agregarCorreoHTTP(correoData: any, endpoint: string, Estado: Types.ObjectId, attachments: object[]) {
        try {
            const correo = new this.filacorreosModel({
                ...correoData,
                endpoint: endpoint,
                Fecha_hora_agregado: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
                Estado: Estado,
                attachments: attachments,
            });
            await correo.save();
        } catch (error) {
            throw new BadRequestException("Error al capturar logs.");
        }
    }
};
