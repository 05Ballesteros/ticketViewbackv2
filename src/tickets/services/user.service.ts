import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Usuario } from 'src/schemas/usuarios.schema';

@Injectable()
export class UserService {
    constructor(
        @InjectModel(Usuario.name) private readonly usuarioModel: Model<Usuario>,
    ) { }
    async verificarAsignado(dto: any) {
        try {
            if (dto.hasResolutor) {
                dto.standby = false;
                dto.Reasignado_a = [dto.Asignado_a];
                return dto;
            }

            const usuarioMesa = await this.usuarioModel
                .findOne({
                    _id: new Types.ObjectId(dto.Asignado_a),
                    $expr: { $eq: ['$Nombre', 'Mesa de Servicio'] },
                })
                .lean();

            const isMesaDeServicio = !!usuarioMesa;

            if (isMesaDeServicio) {
                dto.standby = true;
            }

            return dto;
        } catch (error) {
            throw new BadRequestException('Error al validar el usuario. Error interno en el servidor.');
        }
    };

    async getAsignado(id: string){
        try {
           const asignado = await this.usuarioModel.findById({_id: new Types.ObjectId(id)}).select("-Pasword");
           return asignado;
        } catch (error) {
            throw new BadRequestException("No se encontro el Asignado");
        }
    };

};
