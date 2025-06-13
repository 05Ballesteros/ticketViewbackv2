import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export const validarRol = async (
    rolAsignado: any,
    Moderador: any,
    ticketData: any
): Promise<{ Asignado_a?: Types.ObjectId; Reasignado_a?: Types.ObjectId }> => {
    try {
        const resultado: { Asignado_a?: Types.ObjectId; Reasignado_a?: Types.ObjectId } = {};

        if (rolAsignado !== "Usuario") {
            resultado.Asignado_a = new Types.ObjectId(ticketData.Asignado_a);
        } else if (Moderador) {
            resultado.Asignado_a = new Types.ObjectId(Moderador);
            resultado.Reasignado_a = new Types.ObjectId(ticketData.Asignado_a);
        }

        return resultado;
    } catch (error) {
        console.error(error);
        throw new BadRequestException('No se pudo generar las propiedades de updateData.');
    }
};
