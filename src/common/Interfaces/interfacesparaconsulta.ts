import { Types } from 'mongoose';
export interface ClientePopulated {
  Nombre: string;
  Correo: string;
  Telefono?: string;
  Extension?: string;
  Ubicacion?: string;
  Dependencia: Types.ObjectId;
  Direccion_General: Types.ObjectId;
  direccion_area: Types.ObjectId;
}

export interface TicketPopulated extends Document {
  Cliente: ClientePopulated | Types.ObjectId;
  Asignado_a: any;
}
