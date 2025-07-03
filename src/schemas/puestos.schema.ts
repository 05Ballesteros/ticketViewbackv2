import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'Puestos' })
export class Puesto {
  @Prop({ required: true })
  Puesto: string;
}

export const PuestoSchema = SchemaFactory.createForClass(Puesto);
