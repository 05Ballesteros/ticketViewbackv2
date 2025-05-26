import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'Estados' }) // Nombre correcto de la colección
export class Estado extends Document {
    @Prop({ type: String, required: true })
    Estado: string;
}

export const EstadoSchema = SchemaFactory.createForClass(Estado);