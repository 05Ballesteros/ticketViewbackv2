import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// Interfaz para el documento
export type DireccionAreaDocument = DireccionArea & Document;

@Schema({ collection: 'Direccion_area', timestamps: true }) // Agrega automáticamente createdAt y updatedAt
export class DireccionArea {
  @Prop({ type: String, trim: true, required: true })
  direccion_area: string;
}

// Generar el esquema de Mongoose a partir de la clase
export const DireccionAreaSchema = SchemaFactory.createForClass(DireccionArea);
