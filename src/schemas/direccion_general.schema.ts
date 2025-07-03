import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Direccion_general' })
export class DireccionGeneral extends Document {
  @Prop({ required: true })
  Direccion_General: Types.ObjectId;
}

export const DireccionGeneralSchema = SchemaFactory.createForClass(DireccionGeneral);