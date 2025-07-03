import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clientes } from 'src/schemas/cliente.schema';
import { ClienteConPopulates, DireccionArea } from 'src/common/Interfaces/interfacesparaconsulta';
import { Logs } from 'src/schemas/log.schema';
import { format } from 'date-fns';


@Injectable()
export class LogsService {
    constructor(
        @InjectModel(Logs.name) private readonly logsModel: Model<Logs>,
    ) { }

    async successCorreoTicket(Id: number, accion: string, destinatario: string, emails_extra: string[]) {
        const exito = `✅ Ticket ${Id} ${accion}: correo enviado al usuario ${destinatario}, emails_extra: ${emails_extra}`;
        try {
            const log = new this.logsModel({
                Id: Id,
                Log: exito,
                Fecha_hora_log: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
            });
            await log.save();
            console.log("✅ Log guardado");
            return true;
        } catch (error) {
            throw new BadRequestException("Error al capturar logs.");
        }
    }


    async errorCorreo(Id: number, accion: string, destinatario: string, emails_extra: string[]) {
        const fallo = `❌ Ticket ${Id} ${accion}: error enviado correo al usuario ${destinatario}, emails_extra: ${emails_extra}, correo agregado a la fila.`
        try {
            const log = new this.logsModel({
                Id: Id,
                Log: fallo,
                Fecha_hora_log: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
            });
            await log.save();
            console.log("✅ Log guardado");
            return true;
        } catch (error) {
            throw new BadRequestException("Error al capturar logs.");
        }
    }

    async genericLog(texto: string) {
        try {
            const log = new this.logsModel({
                Log: texto,
                Fecha_hora_log: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
            });
            await log.save();
            console.log("✅ Log guardado");
            return true;
        } catch (error) {
            throw new BadRequestException("Error al capturar logs.");
        }
    }

    async successCorreoContacto(Id: number, destinatario: string, emails_extra: string[]) {
        const exito = `✅ Cliente contactado por ticket ${Id}: correo enviado al cliente ${destinatario}, emails_extra: ${emails_extra}`;
        try {
            const log = new this.logsModel({
                Id: Id,
                Log: exito,
                Fecha_hora_log: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
            });
            await log.save();
            console.log("✅ Log guardado");
            return true;
        } catch (error) {
            throw new BadRequestException("Error al capturar logs.");
        }
    }

    async errorContacto(Id: number, destinatario: string, emails_extra: string[]) {
        const fallo = `❌ Error al contactar cliente por ticket ${Id}: error enviando correo al cliente ${destinatario}, emails_extra: ${emails_extra}`;
        try {
            const log = new this.logsModel({
                Id: Id,
                Log: fallo,
                Fecha_hora_log: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
            });
            await log.save();
            console.log("✅ Log guardado");
            return true;
        } catch (error) {
            throw new BadRequestException("Error al capturar logs.");
        }
    }

     async successPendiente(Id: number, destinatario: string, emails_extra: string[]) {
        const exito = `✅ Ticket ${Id} marcado como pendiente: correo enviado al cliente ${destinatario}, emails_extra: ${emails_extra}`;
        try {
            const log = new this.logsModel({
                Id: Id,
                Log: exito,
                Fecha_hora_log: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
            });
            await log.save();
            console.log("✅ Log guardado");
            return true;
        } catch (error) {
            throw new BadRequestException("Error al capturar logs.");
        }
    }

    async errorPendiente(Id: number, destinatario: string, emails_extra: string[]) {
        const fallo = `❌ Ticket ${Id} marcado como pendiente: error enviando correo al cliente ${destinatario}, emails_extra: ${emails_extra}`;
        try {
            const log = new this.logsModel({
                Id: Id,
                Log: fallo,
                Fecha_hora_log: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
            });
            await log.save();
            console.log("✅ Log guardado");
            return true;
        } catch (error) {
            throw new BadRequestException("Error al capturar logs.");
        }
    }
};
