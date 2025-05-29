import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'Direccion_general' })
export class DireccionGeneral extends Document {
  @Prop({ type: String, trim: true, required: true })
  Direccion_General: string;
}

export const DireccionGeneralSchema = SchemaFactory.createForClass(DireccionGeneral);
