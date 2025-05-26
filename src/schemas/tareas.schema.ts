import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Tareas' })
export class Tareas extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Estado', required: true })
  Estado: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Area', required: true })
  Area: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  Creado_por: Types.ObjectId;

  @Prop({ type: String, required: true })
  Descripcion: string;

  @Prop({ type: Date })
  Fecha_hora_resolucion?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Usuario' })
  Asignado_a?: Types.ObjectId;

  @Prop([
    {
      name: { type: String },
      url: { type: String },
      _id: { type: Types.ObjectId },
    },
  ])
  Files: {
    name: string;
    url: string;
    _id: Types.ObjectId;
  }[];

  @Prop({ type: Types.ObjectId, ref: 'Ticket', required: true })
  IdTicket: Types.ObjectId;

  @Prop({ type: String, required: true })
  Id: string;
}

export const TareasSchema = SchemaFactory.createForClass(Tareas);
