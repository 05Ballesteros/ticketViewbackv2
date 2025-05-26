import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Area' })
export class Area extends Document {
  @Prop({ type: String, required: true })
  Area: string;

  @Prop({ type: [Types.ObjectId], ref: 'Incidencia', default: [] })
  Tipo_de_incidencia: Types.ObjectId[];
}

export const AreaSchema = SchemaFactory.createForClass(Area);
