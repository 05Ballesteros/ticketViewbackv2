import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clientes } from 'src/schemas/cliente.schema';
import { ClienteConPopulates, DireccionArea } from 'src/common/Interfaces/interfacesparaconsulta';
import { Logs } from 'src/schemas/log.schema';
import { format } from 'date-fns';
import axios from 'axios';


@Injectable()
export class LogsService {
    constructor(
        @InjectModel(Logs.name) private readonly logsModel: Model<Logs>,
    ) { }

    async enviarLog(correoData: any, channel: string, token: any, accion?: string) {
        try {
            const url = 'http://logs:4800/api/v1/redis/publish';
            if (typeof channel !== 'string') {
                throw new BadRequestException('El canal debe ser una cadena.');
            }

            const message = {
                channel: channel,
                message: {
                    ...correoData,
                    ...(accion && { accion }), // Solo se agrega si existe
                },
            };

            // Enviar solicitud HTTP
            const response = await axios.post(
                url, message,
                {
                    headers: {
                        Authorization: `Bearer ${token}`, // Cabecera de autenticación
                    },
                },
            );
            return true;
        } catch (error) {
            console.error('Error al guardar Log', error);
            throw new BadRequestException('Error al guardar Log.');
        }
    }

};
