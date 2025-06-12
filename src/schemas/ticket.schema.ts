// src/tickets/schemas/ticket.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';
import { HistoryItem, HistoryItemSchema } from './history-item.schema';

@Schema({ collection: 'Tickets' }) // Nombre correcto de la colección
export class Ticket {
  @Prop({ type: Types.ObjectId, ref: 'Clientes', required: true })
  Cliente: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Estado', required: true })
  Estado: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Medio', required: true })
  Medio: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Area', required: true })
  Area: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  Creado_por: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Categorizacion', required: true })
  Subcategoria: Types.ObjectId;

  @Prop({ type: String, required: true })
  Descripcion: string;

  @Prop({ type: String, default: '' })
  NumeroRec_Oficio: string;

  @Prop({ type: String, default: '' })
  Numero_Oficio: string;

  @Prop({ type: Boolean, default: false })
  vistoBueno: boolean;

  @Prop({ type: Boolean, default: false })
  standby: boolean;

  @Prop({ type: [HistoryItemSchema], default: [] })
  Historia_ticket: HistoryItem[];

  @Prop({ type: [String], default: [] })
  Tags: string[];

  @Prop({ type: Date })
  Fecha_hora_creacion: Date;

  @Prop({ type: Date })
  Fecha_limite_resolucion_SLA: Date;

  @Prop({ type: Date })
  Fecha_limite_respuesta_SLA: Date;

  @Prop({ type: Date })
  Fecha_hora_ultima_modificacion: Date;

  @Prop({ type: Date })
  Fecha_hora_cierre: Date;

  @Prop({ type: Date })
  Fecha_hora_resolucion: Date;

  @Prop({ type: [Types.ObjectId], ref: 'Usuario', default: [] })
  Asignado_a: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Usuario', default: [] })
  Reasignado_a: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Usuario', default: [] })
  Reabierto: Types.ObjectId[];

  @Prop({
    type: [
      {
        name: String,
        url: String,
        _id: { type: Types.ObjectId, default: () => new Types.ObjectId() },
      },
    ],
    default: [],
  })
  Files: { name: string; url: string; _id: Types.ObjectId }[];

  // Estos campos los maneja Mongoose automáticamente si usas timestamps,
  // pero aquí los puedes referenciar como alias si lo deseas:
  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop({ type: Number, unique: true })
  Id: number;

  @Prop({ type: String, default: '' })
  Respuesta_cierre_reasignado: string;

  @Prop({ type: Types.ObjectId, ref: 'Usuario' })
  Resuelto_por: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Usuario' })
  Cerrado_por: Types.ObjectId;

  @Prop({ type: String, default: '' })
  Descripcion_cierre: string;
}

export type TicketDocument = Ticket & Document;
export const TicketSchema = SchemaFactory.createForClass(Ticket);
