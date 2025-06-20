import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from 'src/common/Interfaces/interfacesparaconsulta';
import { Rol } from 'src/schemas/roles.schema';
import { Usuario } from 'src/schemas/usuarios.schema';

@Injectable()
export class UserService {
    constructor(
        @InjectModel(Usuario.name) private readonly usuarioModel: Model<Usuario>,
        @InjectModel(Rol.name) private readonly rolModel: Model<Rol>,
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

    async getUsuario(id: string) {
        try {
            // Convertir el string a ObjectId
            const objectId = new Types.ObjectId(id);
            const usuario = await this.usuarioModel.findOne({ _id: objectId }).populate("Rol");
            return usuario;
        } catch (error) {
            console.log(error);
            throw new BadRequestException("No se encontro el Asignado");
        }
    };

    async getCorreoUsuario(id: any) {
        try {
            // Convertir el string a ObjectId
            const objectId = new Types.ObjectId(id);
            const usuario = await this.usuarioModel.findOne({ _id: objectId }).populate("Rol");
            return usuario?.Correo;
        } catch (error) {
            console.log(error);
            throw new BadRequestException("No se encontro el Asignado");
        }
    };

    async getareaAsignado(userId: any) {
        try {
            const result = await this.usuarioModel.findOne({ _id: userId }).lean();
            if (!result) {
                return false;
            }
            const areaUsuario = await this.usuarioModel.populate(result, [{ path: "Area" }]);
            return areaUsuario.Area[0]?._id;
        } catch (error) {
            return false;
        }
    };

    async getRolAsignado(userId: any): Promise<string> {
    try {
        const result = await this.usuarioModel
            .findOne({ _id: userId })
            .populate<{ Rol: { Rol: string } }>({ path: "Rol", select: "Rol" })
            .lean<User>();

        if (!result || !result.Rol) {
            throw new Error("El rol no fue encontrado para el usuario proporcionado.");
        }

        return result.Rol.Rol;
    } catch (error) {
        console.error("Error en getRolAsignado:", error.message);
        throw new Error("Error al obtener el rol del usuario.");
    }
}


    async getRolModerador(Rol: string) {
        try {
            const result = await this.rolModel.findOne({ Rol }).lean();
            if (!result) {
                return null;
            }
            return result._id;
        } catch (error) {
            console.log("error", error);
            return false;
        }
    };

    async getModeradorPorAreayRol(Area: any, RolModerador: any) {
        try {
            const result = await this.usuarioModel.findOne({
                Area,
                Rol: RolModerador,
            }).select("_id") as User | null;

            if (!result) {
                return "";
            }
            return result._id;
        } catch (error) {
            console.error("Error al obtener moderadores:", error);
            throw new BadRequestException("Error interno del servidor");
        }
    };

    async incTickets(user: any, actualizarContador: any) {
        const result = await this.usuarioModel.findOneAndUpdate(
            { _id: user.userId },
            { $inc: { [`Tickets_resueltos.${actualizarContador}`]: 1 } }
        );
        if (!result) {
            return false;
        }
        return true;
    };

    async getUsuarioMesa(Username: string) {
        try {
            // Convertir el string a ObjectId
            const usuario = await this.usuarioModel.findOne({ Username: Username }).populate("Rol");
            return usuario?._id;
        } catch (error) {
            console.log(error);
            throw new BadRequestException("No se encontro el Asignado");
        }
    };
};
