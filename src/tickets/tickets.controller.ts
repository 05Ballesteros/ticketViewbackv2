import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Put, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors, NotFoundException } from '@nestjs/common';
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
import { PendingReasonDto } from './dto/pendingReason.dto';
import { OficioDto } from './dto/oficio.dto';
import { EditTicketDto } from './dto/edit-ticket.dto';
import { Types, } from 'mongoose';

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
    ): Promise<{ message: string; }> {
         const result = await this.putticketsService.reabrirTicket(ticketData, req.user, token, files, id);
         return {
            message: result.message,
        };
    };

    @Put('resolver/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async resolverTicket(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: any,
    ): Promise<{ message: string; }> {
        console.log('Archivos recibidos:', files);
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

    @Put('oficio/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async agregarOficio(
        @Param('id') id: string,
        @Req() req: any,
        @Token() token: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: OficioDto,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.agregarOficio(ticketData, req.user, files, id, token);
        return {
            message: result.message,
        };
    };

    @Put('PendingReason/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async PendingReason(
        @Param('id') id: string,
        @Req() req: any,
        @Body() ticketData: PendingReasonDto,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.PendingReason(ticketData, req.user, id);
        return {
            message: result.message,
        };
    };

    @Put('editar/:id')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    async editarTicket(
        @Param('id') id: string,
        @Req() req: any,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() ticketData: EditTicketDto,
        @Token() token: string,
    ): Promise<{ message: string }> {
        const result = await this.putticketsService.editarTicket(ticketData, req.user, id, files, token);
        return {
            message: result.message,
        };
    };

    @Get('medios')
    async getMedios() {
        return await this.getticketsService.getMedios();
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

    @Get('areas')
    getAreas() { return this.getticketsService.getAreas(); };

    @Post('areas')
    createAreas(@Body('area') area: string) { 
        return this.postticketsService.createAreas(area); 
    };

    @Put('areas/:id')
    updateArea(@Param('id') id: string, @Body('area') area: string) {
        console.log("area en el controlador", area)
        return this.putticketsService.updateArea(id, area)
    };

    @Get('dependencias')
    getDependencias() { return this.getticketsService.getDependencias(); };

    @Post('dependencias')
    createDependencias(@Body('dependencia') dependencia: string) { 
        return this.postticketsService.createDependencias(dependencia); 
    };

    @Put('dependencias/:id')
    updateDependencia(@Param('id') id: string, @Body('dependencia') dependencia: string) {
        return this.putticketsService.updateDependencia(id, dependencia)
    };

    @Get('dgenerales')
    getDGenerales() { return this.getticketsService.getDGenerales(); };

    @Post('dgenerales')
    createDGeneral(@Body('dgeneral') dgeneral: string) { 
        return this.postticketsService.createDGenerales(dgeneral); 
    };

    @Put('dgenerales/:id')
    updateDGeneral(@Param('id') id: string, @Body('dgeneral') dgeneral: string) {
        return this.putticketsService.updateDGeneral(id, dgeneral)
    };

    @Get('dareas')
    getDAreas() { return this.getticketsService.getDAreas(); };

    @Post('dareas')
    createDArea(@Body('darea') darea: string) { 
        return this.postticketsService.createDAreas(darea); 
    };

    @Put('dareas/:id')
    updateDArea(@Param('id') id: string, @Body('darea') darea: string) {
        return this.putticketsService.updateDArea(id, darea)
    };

    @Post('medios')
    createMedio(@Body('medio') medio: string) { 
        return this.postticketsService.createMedios(medio); 
    };

    @Put('medios/:id')
    updateMedios(@Param('id') id: string, @Body('medio') medio: string) {
        return this.putticketsService.updateMedios(id, medio)
    };

    @Get('puestos')
    getPuestos() { return this.getticketsService.getPuestos(); };

    @Post('puestos')
    createPuestos(@Body('puesto') puesto: string) { 
        return this.postticketsService.createPuestos(puesto); 
    };

    @Put('puestos/:id')
    updatePuesto(@Param('id') id: string, @Body('puesto') puesto: string) {
        return this.putticketsService.updatePuesto(id, puesto)
    };

    @Get('catalogoservicio')
    getCatalogoServicios() { return this.getticketsService.getCatalogoServicios(); };

    // @Post('catalogoservicio')
    // createCatalogoServicios(@Body('catalogo') catalogo: string) { 
    //     return this.postticketsService.createCatalogoServicios(catalogo); 
    // };

    // @Put('catalogoservicio/:id')
    // updateCatalogoServicio(@Param('id') id: string, @Body('catalogo') catalogo: string) {
    //     return this.putticketsService.updateCatalogoServicio(id, catalogo)
    // };


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
                new Map(resultado.map((item) => [(item._id as Types.ObjectId).toString(), item])).values(),
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

    @Get('/area')
    async getBusquedaAvanzadaArea(@Query('termino') area: string) {
        try {
            return this.getticketsService.getBusquedaAvanzadaArea(area);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: errorMessage },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('/celula')
    async getBusquedaAvanzadaCelula(@Query('termino') celula: string) {
        try {
            return this.getticketsService.getBusquedaAvanzadaCelula(celula);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

            throw new HttpException(
                { message: 'Error interno al obtener los tickets.', details: errorMessage },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('/:id')
    getTicket(
        @Param('id') id: string) {
        return this.getticketsService.getTicket(id);
    };

};