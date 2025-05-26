import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Subcategoria' })
export class Subcategoria extends Document {
  @Prop({ required: true })
  Subcategoria: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Categoria' }], default: [] })
  Categoria: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Servicio' }], default: [] })
  Servicio: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Area' }], default: [] })
  Area: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'TipoIncidencia' }], default: [] })
  Tipo_de_incidencia: Types.ObjectId[];
}

export const subcategoriaSchema = SchemaFactory.createForClass(Subcategoria);