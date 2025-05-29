import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Area' })
export class Area extends Document {
  @Prop({ type: String, required: true })
  Area: string;
}

export const AreaSchema = SchemaFactory.createForClass(Area);
