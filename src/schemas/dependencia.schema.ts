import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'Dependencia', timestamps: true })
export class Dependencia extends Document {
  @Prop({ type: String, trim: true, required: true })
  Dependencia: string;
}

export const DependenciaSchema = SchemaFactory.createForClass(Dependencia);
