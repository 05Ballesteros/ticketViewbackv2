// counter.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class CounterService {
  constructor(
    @InjectModel('Counter') private readonly counterModel: Model<any>, // Ajusta el tipo si tienes una interfaz
  ) {}

  async getNextSequence(sequenceId: string): Promise<number> {
    const updatedCounter = await this.counterModel.findOneAndUpdate(
      { id: sequenceId }, // Buscar por el campo `id`
      { $inc: { seq: 1 } }, // Incrementar el campo `seq`
      { new: true, upsert: true } // Crear el documento si no existe
    );

    if (!updatedCounter) {
      throw new Error(`No se pudo incrementar el contador para ${sequenceId}`);
    }

    return updatedCounter.seq; // Devolver el valor incrementado
  }
}
