import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
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
import { Token } from 'src/common/decorators/token.decorator';

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
    ): Promise<Ticket> {
        return this.postticketsService.crearTicket(dto, req.user, token, files);
    };

    @Post('asignar/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async asignarTicket(
        @Req() req: any,
        @Cookie('access_token') token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() dto: CreateTicketDto,  //Crear un Dto para asignación
    ): Promise<Ticket> {
        return this.putticketsService.asgnarTicket(dto, req.user, token, files);
    };

    @Get('estado/:estado')
    getTickets(@Param('estado') estado: string,
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

};