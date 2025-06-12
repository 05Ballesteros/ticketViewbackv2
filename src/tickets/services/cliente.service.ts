import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clientes } from 'src/schemas/cliente.schema';
import { ClienteConPopulates, DireccionArea } from 'src/common/Interfaces/interfacesparaconsulta';

@Injectable()
export class ClienteService {
  constructor(@InjectModel(Clientes.name) private readonly clienteModel: Model<Clientes>) {}

  async getCliente(id: string) {
    try {
      return (await this.clienteModel
        .findOne(new Types.ObjectId(id))
        .populate<{ direccion_area: DireccionArea }>('direccion_area')
        .exec()) as ClienteConPopulates;
    } catch (error) {
      throw new BadRequestException('No se encontro el Cliente');
    }
  }
}
