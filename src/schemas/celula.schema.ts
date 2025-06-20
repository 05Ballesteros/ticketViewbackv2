import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Celulas' })
export class Celula extends Document {
  @Prop({ type: String })
  Celula: string;
}

export const CelulaSchema = SchemaFactory.createForClass(Celula);
