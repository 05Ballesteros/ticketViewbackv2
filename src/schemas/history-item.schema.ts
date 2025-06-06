// src/tickets/schemas/history-item.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ _id: true })
export class HistoryItem {
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  Nombre: Types.ObjectId;

  @Prop({ type: String, required: true })
  Mensaje: string;

  @Prop({ type: Date, required: true })
  Fecha: Date;

  @Prop({ type: String, required: true })
  Titulo: string;
}

export const HistoryItemSchema = SchemaFactory.createForClass(HistoryItem);
