// src/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Clientes' }) // Nombre correcto de la colección
export class Cliente {
  @Prop({ required: true })
  Nombre: string;

  @Prop({ required: true, unique: true })
  Correo: string;

  @Prop({ type: Types.ObjectId, ref: 'Dependencia', required: true })
  Dependencia: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DireccionGeneral', required: true })
  Direccion_General: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Area', required: true })
  direccion_area: Types.ObjectId;

  @Prop()
  Telefono: string;

  @Prop()
  Extension: string;

  @Prop()
  Ubicacion: string;
}

export type UserDocument = Cliente & Document;
export const ClienteSchema = SchemaFactory.createForClass(Cliente);
