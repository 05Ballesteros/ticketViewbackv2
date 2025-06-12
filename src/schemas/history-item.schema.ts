// src/tickets/schemas/history-item.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { obtenerFechaActual } from 'src/common/utils/fechas';

@Schema({ _id: true })
export class HistoryItem {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  Nombre: Types.ObjectId;

  @Prop({ type: String, required: true })
  Mensaje: string;

  @Prop({ type: Date, required: true, default: obtenerFechaActual() })
  Fecha: Date;

  @Prop({ type: String, required: true })
  Titulo: string;

  @Prop({ type: Boolean, required: true, default: false })
  stopper: boolean;
}

export const HistoryItemSchema = SchemaFactory.createForClass(HistoryItem);
