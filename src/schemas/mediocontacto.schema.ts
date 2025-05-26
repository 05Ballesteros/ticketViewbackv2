import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'Medios_contacto' }) // Nombre correcto de la colección
export class Medio extends Document {
    @Prop({ type: String, required: true })
    Medio: string;
}

export const MedioSchema = SchemaFactory.createForClass(Medio);