import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoriaDocument = Categoria & Document;

@Schema({ collection: 'Categorias', timestamps: true })
export class Categoria {
  @Prop({ type: String, trim: true, required: true })
  Categoria: string;
}

export const CategoriaSchema = SchemaFactory.createForClass(Categoria);
