import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// Interface para el documento
export type ServicioDocument = Servicio & Document;

@Schema({ collection : 'Servicios', timestamps: true }) // Agrega automáticamente createdAt y updatedAt
export class Servicio {
  @Prop({ type: String, trim: true, required: true })
  Servicio: string;
}

// Generar el esquema de Mongoose a partir de la clase
export const ServicioSchema = SchemaFactory.createForClass(Servicio);
