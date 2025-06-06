import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Interfaz para el documento
export type CategorizacionDocument = Categorizacion & Document;

@Schema({ collection: 'Categorizacion', timestamps: true }) // Habilita campos createdAt y updatedAt automáticamente
export class Categorizacion {
  @Prop({ type: String, trim: true, required: true })
  Subcategoria: string;

  @Prop({ type: String, trim: true, required: true })
  Categoria: string;

  @Prop({ type: String, trim: true, required: true })
  Servicio: string;

  @Prop({ type: String, trim: true, required: true })
  Tipo: string;

  @Prop({ type: Types.ObjectId, ref: 'Area', required: true })
  Equipo: Types.ObjectId;

  @Prop({ type: Number, required: true })
  Prioridad: number;

  @Prop({ type: String, trim: true, required: true })
  Descripcion_prioridad: string;
}

// Generar el esquema de Mongoose a partir de la clase
export const CategorizacionSchema = SchemaFactory.createForClass(Categorizacion);
