import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Logs' })
export class Logs extends Document {
  @Prop({ type: Number })
  Id: number;

  @Prop({ required: true })
  Log: string;

  @Prop({ type: Date })
  Fecha_hora_log: Date;
}

export const LogsSchema = SchemaFactory.createForClass(Logs);
