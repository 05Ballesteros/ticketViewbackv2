import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'Roles', timestamps: true })
export class Rol extends Document {
  @Prop({ type: String, trim: true, required: true })
  Rol: string;
}

export const RolSchema = SchemaFactory.createForClass(Rol);
