import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Usuarios', timestamps: true })
export class Usuario extends Document {
  @Prop({ type: String, required: true })
  Username: string;

  @Prop({ type: String, required: true })
  Password: string;

  @Prop({ type: String, required: true })
  Nombre: string;

  @Prop({ type: Types.ObjectId, ref: 'Rol', required: true })
  Rol: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Area', required: true })
  Area: Types.ObjectId[];

  @Prop({ type: String, required: true })
  Correo: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({
    type: {
      a_tiempo: { type: Number, default: 0 },
      fuera_tiempo: { type: Number, default: 0 },
    },
  })
  Tickets_resueltos: {
    a_tiempo: number;
    fuera_tiempo: number;
  };
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
