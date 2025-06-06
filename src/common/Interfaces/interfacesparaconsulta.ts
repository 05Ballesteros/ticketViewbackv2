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

export interface DireccionArea {
  _id: Types.ObjectId;
  direccion_area: string;
}


export interface ClienteConPopulates {
  _id: Types.ObjectId;
  Nombre: string;
  Correo: string;
  Dependencia: Types.ObjectId | { _id: Types.ObjectId; nombre: string }; // Ejemplo si Dependencia tiene más campos
  Direccion_General: Types.ObjectId | { _id: Types.ObjectId; nombre: string }; // Similar a Dependencia
  direccion_area: DireccionArea; // Ya expandido por el populate
  Telefono: string;
  Extension: string;
  Ubicacion: string;
}

export interface User {
    _id: string; // ID del usuario en formato string
    Area: string; // Área asignada al usuario
    Rol?: { Rol: string }; // Rol del usuario, opcional y estructurado como un objeto con una propiedad 'Rol'
}
