import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'Counters' })
export class Counter {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: Number, required: true })
  seq: number;
}

export type CounterDocument = Counter & Document;
export const CounterSchema = SchemaFactory.createForClass(Counter);
