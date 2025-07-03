import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { GetTicketsService } from './services/gettickets.service';
import { TicketsController } from './tickets.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from 'src/schemas/ticket.schema';
import { Estado, EstadoSchema } from 'src/schemas/estados.schema';
import { PostTicketsService } from './services/posttickets.service';
import { Usuario, UsuarioSchema } from 'src/schemas/usuarios.schema';
import { Area, AreaSchema } from 'src/schemas/area.schema';
import { Clientes, ClienteSchema } from 'src/schemas/cliente.schema';
import { Subcategoria, subcategoriaSchema } from 'src/schemas/subcategoria.schema';
import { Medio, MedioSchema } from 'src/schemas/mediocontacto.schema';
import { Prioridad, PrioridadSchema } from 'src/schemas/prioridades.schema';
import { Rol, RolSchema } from 'src/schemas/roles.schema';
import { Dependencia, DependenciaSchema } from 'src/schemas/dependencia.schema';
import { DireccionGeneral, DireccionGeneralSchema } from 'src/schemas/direccion_general.schema';
import { TipoTicket } from 'src/schemas/tipoticket.schema';
import { Categoria, CategoriaSchema } from 'src/schemas/categoria.schema';
import { Servicio, ServicioSchema } from 'src/schemas/servicio.schema';
import { Categorizacion, CategorizacionSchema } from 'src/schemas/categorizacion.schema';
import { DireccionArea, DireccionAreaSchema } from 'src/schemas/direccionarea.schema';
import { UserService } from './services/user.service';
import { ClienteService } from './services/cliente.service';
import { CorreoService } from './services/correos.service';
import { PutTicketsService } from './services/puttickets.service';
import { CounterService } from './services/counter.service';
import { Counter, CounterSchema } from 'src/schemas/counter.schema';
import { Logs, LogsSchema } from 'src/schemas/log.schema';
import { LogsService } from './services/logs.service';
import { FilaCorreosService } from './services/filacorreos.service';
import { Filacorreos, FilaCorreosSchema } from 'src/schemas/filacorreos.schema';

const mongooseSchemas = [
  { name: Ticket.name, schema: TicketSchema },
  { name: Estado.name, schema: EstadoSchema },
  { name: Usuario.name, schema: UsuarioSchema },
  { name: Clientes.name, schema: ClienteSchema },
  { name: Subcategoria.name, schema: subcategoriaSchema },
  { name: Prioridad.name, schema: PrioridadSchema },
  { name: Rol.name, schema: RolSchema },
  { name: Dependencia.name, schema: DependenciaSchema },
  { name: DireccionGeneral.name, schema: DireccionGeneralSchema },
  { name: TipoTicket.name, schema: TicketSchema },
  { name: Categoria.name, schema: CategoriaSchema },
  { name: Servicio.name, schema: ServicioSchema },
  { name: Medio.name, schema: MedioSchema },
  { name: Area.name, schema: AreaSchema },
  { name: Categorizacion.name, schema: CategorizacionSchema },
  { name: DireccionArea.name, schema: DireccionAreaSchema },
  { name: Counter.name, schema: CounterSchema },
  { name: Logs.name, schema: LogsSchema },
  { name: Filacorreos.name, schema: FilaCorreosSchema},
];
@Module({
  imports: [MongooseModule.forFeature(mongooseSchemas)],
  providers: [
    GetTicketsService,
    PostTicketsService,
    UserService,
    ClienteService,
    CorreoService,
    PutTicketsService,
    CounterService,
    LogsService,
    FilaCorreosService
  ],
  controllers: [TicketsController]
})
export class TicketsModule { };
