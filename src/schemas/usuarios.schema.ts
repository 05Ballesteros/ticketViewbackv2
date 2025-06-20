import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'Usuarios', timestamps: true })
export class Usuario extends Document {
  @Prop({ type: String, required: true })
  Username: string;

  @Prop({ type: String, required: true, select: false })
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

  @Prop({ type: Types.ObjectId, ref: "Dependencia", default: "679b8a12c9c34d1de358f1cd" })
  Dependencia: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "DireccionGeneral" })
  Direccion_General: Types.ObjectId;

  @Prop({ type: String, default: "Dirección de informática - Piso 6" })
  Ubicacion: string;

  @Prop({ type: String, default: "0000000000" })
  Telefono: string;

  @Prop({ type: String, default: "Empleado" })
  Puesto: string;

  @Prop({ type: String, default: "00000" })
  Extension: string;

  @Prop({
    Pais: { type: String, default: "México" },
    Ciudad: { type: String, default: "Guadalajara/Jalisco" },
    codigoPostal: { type: String, default: "44266" }
  })
  Pais: string
  Ciudad: string
  codigoPostal: string

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

  @Prop({ type: [Types.ObjectId], ref: 'Celula' })
  Celula: Types.ObjectId[];
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
