import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TipoTicketDocument = TipoTicket & Document;

@Schema({ collection: 'Tipo_ticket', timestamps: true })
export class TipoTicket {
  @Prop({ type: String, trim: true, required: true })
  Tipo_de_incidencia: string;
}

export const TipoTicketSchema = SchemaFactory.createForClass(TipoTicket);
