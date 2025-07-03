import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Fila_Correos' })
export class Filacorreos extends Document {
  @Prop({ required: true })
  Id: number;

  @Prop({ type: Types.ObjectId, ref: 'Estado', required: true })
  Estado: Types.ObjectId;

  @Prop({ type: String, default: "" })
  destinatario: string;

  @Prop({ type: [String] })
  emails_extra: string[];

  @Prop({ type: String })
  details: string;

  @Prop({ type: String })
  nombre: string;

  @Prop({ type: String })
  telefono: string;

  @Prop({ type: String })
  extension: string;

  @Prop({ type: String })
  ubicacion: string;

  @Prop({ type: String })
  area: string;

  @Prop({ type: String })
  channel: string;

  @Prop({ type: String })
  endpoint: string;

  @Prop({ type: Date })
  Fecha_hora_agregado: Date;

  @Prop({ type: [Object] })
  attachments: object[];
}

export const FilaCorreosSchema = SchemaFactory.createForClass(Filacorreos);
