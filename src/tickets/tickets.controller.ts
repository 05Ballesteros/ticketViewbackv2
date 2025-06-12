import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GetTicketsService } from './services/gettickets.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PostTicketsService } from './services/posttickets.service';
import { Response } from 'express';
import * as fs from 'fs';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerOptions } from 'src/common/utils/multer.diskStorage';
import { Ticket } from 'src/schemas/ticket.schema';
import { Cookie } from 'src/common/decorators/cookie.decorador';
import { PutTicketsService } from './services/puttickets.service';
import { Token } from 'src/common/decorators/token.decorator';
import { Request } from 'express';
@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(
    private readonly getticketsService: GetTicketsService,
    private readonly postticketsService: PostTicketsService,
    private readonly putticketsService: PutTicketsService,
  ) {}

  @Post('crear/ticket')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  async crearTicket(
    @Req() req: Request & { user: any },
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateTicketDto, // <-- mapea y valida directo
    @Token() token: string,
  ): Promise<Ticket> {
    return this.postticketsService.crearTicket(dto, req.user, token, files);
  }

  @Post('asignar/:id')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  async asignarTicket(
    @Req() req: Request & { user: any },
    @Cookie('access_token') token: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateTicketDto, //Crear un Dto para asignación
  ): Promise<Ticket> {
    return this.putticketsService.asgnarTicket(dto, req.user, token, files);
  }

  @Get('estado/:estado')
  getTickets(@Param('estado') estado: string, @Req() req: Request & { user: any }) {
    return this.getticketsService.getTickets(estado, req.user);
  }

  @Get('reabrir/fields')
  getreabrirFields() {
    return this.getticketsService.getReabrirFields();
  }

  @Get('asignar/areas')
  getareasAsignacion() {
    return this.getticketsService.getareasAsignacion();
  }

  @Get('reasignar/areas')
  getareasResignacion(@Req() req: Request & { user: any }) {
    return this.getticketsService.getareasReasignacion(req.user);
  }

  @Get('crear/getInfoSelects')
  getInfoSelects() {
    return this.getticketsService.getInfoSelects();
  }

  @Get('historico')
  getAreas() {
    return this.getticketsService.getAreas();
  }

  @Get('historico/area')
  getTicketsPorArea(@Query('area') area: string) {
    try {
      return this.getticketsService.getTicketsPorArea(area);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('resolutor/:id')
  async getTicketsResolutor(@Param('id') userid: string) {
    try {
      return this.getticketsService.getTicketsResolutor(userid);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('export/excel')
  async exportTicketsToExcel(@Res() res: Response) {
    try {
      const filePath = await this.getticketsService.exportTicketsToExcel();
      res.download(filePath, 'tickets.xlsx', (err) => {
        if (err) {
          throw err;
        }
        fs.unlinkSync(filePath);
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('clientes/dependencias')
  getDependenciasCLientes() {
    try {
      return this.getticketsService.getDependenciasCLientes();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('correos/:id')
  getCorreos(@Param('id') id: string) {
    try {
      return this.getticketsService.getCorreos(id);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('buscar/:id')
  async getTicketsPorId(@Param('id') id: string) {
    try {
      return this.getticketsService.getTicketsPorId(id);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('calendario')
  async getCalendario(@Req() req: Request & { user: { areas: string[]; userId: string } }) {
    try {
      const { areas, userId } = req.user;
      return this.getticketsService.getCalendario(areas, userId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('perfil')
  async getPerfil(@Req() req: Request & { user: { userId: string } }) {
    try {
      const { userId } = req.user;
      return this.getticketsService.getPerfil(userId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/general')
  async busquedaGeneral(@Query('termino') termino: string) {
    try {
      const resultado: Ticket[] = [];

      try {
        const resOficio = await this.getticketsService.getBusquedaAvanzadaOficio(termino);
        resultado.push(...resOficio);
      } catch (error) {
        console.error('Error en búsqueda por oficio:', error);
      }

      try {
        const resCliente = await this.getticketsService.busquedaAvanzadaPorCliente(termino);
        resultado.push(...resCliente);
      } catch (error) {
        console.error('Error en búsqueda por cliente:', error);
      }

      try {
        const resResolutor = await this.getticketsService.busquedaAvanzadaPorResolutor(termino);
        resultado.push(...resResolutor);
      } catch (error) {
        console.error('Error en búsqueda por resolutor:', error);
      }

      try {
        const resId = await this.getticketsService.getBusquedaAvanzadaId(termino);
        resultado.push(...resId);
      } catch (error) {
        console.error('Error en búsqueda por ID:', error);
      }

      // Eliminar duplicados por _id (suponiendo que tus objetos tienen este campo)
      const resultadoUnico: Ticket[] = Array.from(
        new Map(resultado.map((item) => [item._id.toString(), item])).values(),
      );

      if (resultadoUnico.length > 0) {
        return resultadoUnico;
      }

      throw new NotFoundException('No se encontraron tickets para este término de búsqueda');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/id')
  async getBusquedaAvanzadaId(@Query('termino') id: string) {
    try {
      return this.getticketsService.getBusquedaAvanzadaId(id);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/oficio')
  async getBusquedaAvanzadaOficio(@Query('termino') nombreOficio: string) {
    try {
      return this.getticketsService.getBusquedaAvanzadaOficio(nombreOficio);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/nccliente')
  async getBusquedaAvanzadaNcCliente(@Query('termino') paramCliente: string) {
    try {
      return this.getticketsService.busquedaAvanzadaPorCliente(paramCliente);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/ncresolutor')
  async getBusquedaAvanzadaNcResolutor(@Query('termino') paramResolutor: string) {
    try {
      return this.getticketsService.busquedaAvanzadaPorResolutor(paramResolutor);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('/pendiente/:id')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  async marcarTicketPendiente(
    @Param('id') _id: string,
    @Req() req: Request & { user: any },
    @Body() data: { cuerpoCorreo: string; emailsExtra: string[] },
    @UploadedFiles() files: Express.Multer.File[],
    @Token() token: string,
  ) {
    try {
      const cuerpoCorreo = data.cuerpoCorreo;
      const emails_extra = data.emailsExtra;
      return this.putticketsService.marcarTicketPendiente(
        _id,
        req.user,
        cuerpoCorreo,
        emails_extra,
        files,
        token,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('/contactoCliente/:id')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  async contactarCliente(
    @Param('id') _id: string,
    @Req() req: Request & { user: any },
    @Body() data: { cuerpoCorreo: string; emailsExtra: string[] },
    @UploadedFiles() files: Express.Multer.File[],
    @Token() token: string,
  ) {
    try {
      const cuerpoCorreo = data.cuerpoCorreo;
      const emails_extra = data.emailsExtra;
      return this.putticketsService.contactarCliente(
        _id,
        req.user,
        cuerpoCorreo,
        emails_extra,
        files,
        token,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new HttpException(
        { message: 'Error interno al obtener los tickets.', details: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
