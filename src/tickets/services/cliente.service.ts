import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cliente } from 'src/schemas/cliente.schema';

@Injectable()
export class ClienteService {
    constructor(
        @InjectModel(Cliente.name) private readonly clienteModel: Model<Cliente>,
    ) { }

    async getCliente(id: string){
        try {
           return await this.clienteModel.findById({_id: new Types.ObjectId(id)}).populate("direccion_area");
        } catch (error) {
            throw new BadRequestException("No se encontro el Cliente");
        }
    };

};
