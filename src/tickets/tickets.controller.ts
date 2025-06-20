import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Put, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { GetTicketsService } from './services/gettickets.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PostTicketsService } from './services/posttickets.service';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CreateTicketDto, FileDto } from './dto/create-ticket.dto';
import { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerOptions } from 'src/common/utils/multer.diskStorage';
import { Ticket } from 'src/schemas/ticket.schema';
import { Cookie } from 'src/common/decorators/cookie.decorador';
import { PutTicketsService } from './services/puttickets.service';
import { AsignarTicketDto } from './dto/asignar-ticket.dto';
import { Token } from 'src/common/decorators/token.decorator';
import { ReabrirTicketDto } from './dto/reabrir-ticket.dto';
import { ReasignarTicketDto } from './dto/reasignar-ticket.dto';
import { ResolverTicketDto } from './dto/resolver-ticket.dto';
import { AceptarSolucionDto } from './dto/aceptarSolucion-ticket.dto';
import { RechazarSolucionDto } from './dto/rechazarSolucion-ticket.dto';
import { RegresarTicketMesaDto, RegresarTicketModeradorDto, RegresarTicketResolutorDto } from './dto/regresar-ticket.dto';
import { CerrarTicketDto } from './dto/cerrar-ticket.dto';
import { NotaDto } from './dto/nota.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
    constructor(
        private readonly getticketsService: GetTicketsService,
        private readonly postticketsService: PostTicketsService,
        private readonly putticketsService: PutTicketsService,) { }

    @Post('crear/ticket')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async crearTicket(
        @Req() req: any,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() dto: CreateTicketDto,      // <-- mapea y valida directo
        @Token() token: string,
    ): Promise<{ message: string; }> {
        const result = await this.postticketsService.crearTicket(dto, req.user, token, files);
        return {
            message: result.message,
        };
    };

    @Put('asignar/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async asignarTicket(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: AsignarTicketDto,
    ): Promise<{ message: string; }> {
        const result = await this.putticketsService.asginarTicket(ticketData, req.user, token, files, id);
        return {
            message: result.message,
        };
    };

    @Put('reasignar/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async reasignarTicket(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: ReasignarTicketDto,
    ): Promise<{ message: string; }> {
        const result = await this.putticketsService.reasginarTicket(ticketData, req.user, token, files, id);
        return {
            message: result.message,
        };
    };

    @Put('reabrir/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async reabrirTicket(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: ReabrirTicketDto,
    ): Promise<Ticket> {
        return this.putticketsService.reabrirTicket(ticketData, req.user, token, files, id);
    };

    @Put('resolver/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async resolverTicket(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: ResolverTicketDto,
    ): Promise<{ message: string; }> {
        const result = await this.putticketsService.resolverTicket(ticketData, req.user, token, files, id);
        return {
            message: result.message,
        };
    };

    //NO es necesario enviar un formdata
    @Put('resolver/aceptar/:id')
    async aceptarResolucionTicket(
        @Param('id') id: string,
        @Req() req: any,
        @Body() ticketData: AceptarSolucionDto,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.aceptarResolucion(ticketData, req.user, id);
        return {
            message: result.message,
        };
    };

    @Put('resolver/rechazar/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async rechazarResolucionTicket(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: RechazarSolucionDto,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.rechazarResolucion(ticketData, req.user, files, token, id);
        return {
            message: result.message,
        };
    };

    @Put('retornoMesa/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async retornarTicket(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: RegresarTicketMesaDto,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.regresarTicketMesa(ticketData, req.user, files, token, id);
        return {
            message: result.message,
        };
    };

    @Put('retornoModerador/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async retornarTicketModerador(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: RegresarTicketModeradorDto,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.regresarTicketModerador(ticketData, req.user, files, token, id);
        return {
            message: result.message,
        };
    };

    @Put('regresar/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async retornarTicketResolutor(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: RegresarTicketResolutorDto,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.regresarTicketResolutor(ticketData, req.user, files, token, id);
        return {
            message: result.message,
        };
    };
    
    @Put('cerrar/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async cerrarTicket(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: CerrarTicketDto,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.cerrarTicket(ticketData, req.user, token, files, id);
        return {
            message: result.message,
        };
    };

    @Put('nota/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async agregarNota(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: NotaDto,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.agregarNota(ticketData, req.user, files, id, token);
        return {
            message: result.message,
        };
    };


    @Get('/:id')
    getTicket(
        @Param('id') id: string) {
        return this.getticketsService.getTicket(id);
    };

    @Get('estado/:estado')
    getTickets(
        @Param('estado') estado: string,
        @Req() req: any,) {
        const user = req.user;
        return this.getticketsService.getTickets(estado, user);
    };

    @Get('reabrir/fields')
    getreabrirFields() {
        return this.getticketsService.getReabrirFields();
    };

    @Get('asignar/areas')
    getareasAsignacion() {
        return this.getticketsService.getareasAsignacion();
    };

    @Get('reasignar/areas')
    getareasResignacion(@Req() req: any) {
        const user = req.user;
        return this.getticketsService.getareasReasignacion(user);
    };

    @Get('crear/getInfoSelects')
    getInfoSelects() { return this.getticketsService.getInfoSelects(); };

    @Get('historico')
    getAreas() { return this.getticketsService.getAreas(); };

    @Get('historico/area')
    getTicketsPorArea(@Query('area') area: string) {
        try {
            return this.getticketsService.getTicketsPorArea(area);
        } catch (error) {
            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    };

    @Get('resolutor/:id')
    async getTicketsResolutor(@Param('id') userid: string) {
        try {
            return this.getticketsService.getTicketsResolutor(userid);
        } catch (error) {
            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

    };

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
        } catch (error) {
            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    };

    @Get('clientes/dependencias')
    getDependenciasCLientes() {
        try {
            return this.getticketsService.getDependenciasCLientes();
        } catch (error) {
            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    };

    @Get('correos/:id')
    getCorreos(@Param('id') id: string) {
        try {
            return this.getticketsService.getCorreos(id);
        } catch (error) {
            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    };

    @Get('buscar/:id')
    async getTicketsPorId(@Param('id') id: string) {
        try {
            return this.getticketsService.getTicketsPorId(id);
        } catch (error) {
            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    };

    @Get('calendario')
    async getCalendario(@Req() req: any) {
        try {
            const { areas, userId } = req.user;
            return this.getticketsService.getCalendario(areas, userId);
        } catch (error) {
            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    };

    @Get('perfil')
    async getPerfil(@Req() req: any) {
        try {
            const { userId } = req.user;
            return this.getticketsService.getPerfil(userId);
        } catch (error) {
            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    };

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

};