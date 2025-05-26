import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PrioridadDocument = Prioridad & Document;

@Schema({ collection: 'Prioridades' })
export class Prioridad {
  @Prop({ type: Number, trim: true, required: true })
  Prioridad: number;

  @Prop({ type: String, trim: true, required: true })
  Descripcion: string;
}

export const PrioridadSchema = SchemaFactory.createForClass(Prioridad);
