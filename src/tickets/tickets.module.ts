import { Module } from '@nestjs/common';
import { GetTicketsService } from './services/gettickets.service';
import { TicketsController } from './tickets.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from 'src/schemas/ticket.schema';
import { Estado, EstadoSchema } from 'src/schemas/estados.schema';
import { PostTicketsService } from './services/posttickets.service';
import { Usuario, UsuarioSchema } from 'src/schemas/usuarios.schema';
import { Area, AreaSchema } from 'src/schemas/area.schema';
import { Cliente, ClienteSchema } from 'src/schemas/cliente.schema';
import { Subcategoria, subcategoriaSchema } from 'src/schemas/subcategoria.schema';
import { Medio, MedioSchema } from 'src/schemas/mediocontacto.schema';
import { Prioridad, PrioridadSchema } from 'src/schemas/prioridades.schema';
import { Rol, RolSchema } from 'src/schemas/roles.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ticket.name, schema: TicketSchema }]),
    MongooseModule.forFeature([{ name: Estado.name, schema: EstadoSchema }]),
    MongooseModule.forFeature([{ name: Medio.name, schema: MedioSchema }]),
    MongooseModule.forFeature([{ name: Usuario.name, schema: UsuarioSchema }]),
    MongooseModule.forFeature([{ name: Area.name, schema: AreaSchema }]),
    MongooseModule.forFeature([{ name: Cliente.name, schema: ClienteSchema }]),
    MongooseModule.forFeature([{ name: Subcategoria.name, schema: subcategoriaSchema }]),
    MongooseModule.forFeature([{ name: Prioridad.name, schema: PrioridadSchema }]),
    MongooseModule.forFeature([{ name: Rol.name, schema: RolSchema }]),
  ],
  providers: [GetTicketsService, PostTicketsService],
  controllers: [TicketsController]
})
export class TicketsModule { }
