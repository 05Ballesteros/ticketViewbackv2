import { BadRequestException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Estado } from 'src/schemas/estados.schema';
import { Model, Types } from 'mongoose';
import { Ticket } from 'src/schemas/ticket.schema';
import { Usuario } from 'src/schemas/usuarios.schema';
import { GetTicketsService } from './gettickets.service';
import { calcularFechaResolucion } from 'src/common/utils/calcularFechaResolucion';
import { fechaDefecto, obtenerFechaActual } from 'src/common/utils/fechas';
import { addHours } from 'date-fns';
import { historicoCreacion } from 'src/common/utils/historico';
import { guardarArchivos } from 'src/common/utils/guardarArchivos';
import { UserService } from './user.service';
import { ClienteService } from './cliente.service';
import { Clientes } from 'src/schemas/cliente.schema';
import { CorreoService } from './correos.service';
import { channel } from 'diagnostics_channel';
import * as fs from 'fs';
import axios from 'axios';
import FormData = require('form-data');
@Injectable()
export class PutTicketsService {
  constructor(
    private readonly getticketsService: GetTicketsService,
    private readonly userService: UserService,
    private readonly clienteService: ClienteService,
    private readonly correoService: CorreoService,
    @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
    @InjectModel(Estado.name) private readonly estadoModel: Model<Estado>,
    @InjectModel(Clientes.name) private readonly clienteModel: Model<Clientes>,
  ) { }
  async asgnarTicket(dto: any, user: any, token: string, files: any): Promise<Ticket> {
    try {
      //1.-Verificar el asignado
      const dtoAsignado = await this.userService.verificarAsignado(dto);
      //2.- Verificar estado segun el asignado
      const dtoEstado = await this.getticketsService.getestadoTicket(dtoAsignado);
      //3.- Obtener información con la subcategoria
      const Categorizacion = await this.getticketsService.getCategorizacion(
        new Types.ObjectId(dto.Subcategoria),
      );
      //4.- Calcular las fechas
      const Fecha_limite = calcularFechaResolucion(dto.Tiempo);
      //5.- Obtencion del asignado
      const asignado = await this.userService.getAsignado(dtoAsignado.Asignado_a);
      console.log('Asignado', asignado);
      //6.- Se obtiene el cliente
      const cliente = await this.clienteService.getCliente(dto.Cliente);
      console.log('Cliente', cliente);
      //5.- LLenado del hostorico
      const Historia_ticket = await historicoCreacion(user, asignado);
      const data = {
        Cliente: new Types.ObjectId(dto.Cliente),
        Medio: new Types.ObjectId(dto.Medio),
        Asignado_a: new Types.ObjectId(dto.Asignado_a),
        Subcategoria: new Types.ObjectId(dto.Subcategoria),
        Descripcion: dto.Descripcion,
        NumeroRec_Oficio: dto.NumeroRec_Oficio,
        Creado_por: new Types.ObjectId(user.UserId),
        Estado: dtoEstado.Estado,
        Area: Categorizacion?.Equipo,
        Fecha_hora_creacion: obtenerFechaActual(),
        Fecha_limite_resolucion_SLA: Fecha_limite,
        Fecha_limite_respuesta_SLA: addHours(obtenerFechaActual(), dto.Tiempo),
        Fecha_hora_ultima_modificacion: obtenerFechaActual(),
        Fecha_hora_cierre: fechaDefecto,
        Fecha_hora_resolucion: fechaDefecto,
        Fecha_hora_reabierto: fechaDefecto,
        Historia_ticket: Historia_ticket,
      };
      //6.- Se guarda el ticket
      let ticketInstance = new this.ticketModel(data);
      const savedTicket = await ticketInstance.save();
      if (!savedTicket) {
        throw new BadRequestException('No se creó el ticket.');
      }
      //7.- Se valida si el ticket se guardo correctamente y si hay archivos para guardar
      if (files.length > 0) {
        console.log('Ticket guardado correctamente');
        const { data: uploadedFiles } = await guardarArchivos(token, files);
        const updatedTicket = await this.ticketModel.findByIdAndUpdate(
          { _id: ticketInstance._id },
          {
            $push: {
              Files: {
                $each: uploadedFiles.map((file) => ({ ...file, _id: new Types.ObjectId() })),
              },
            },
          },
          { new: true, upsert: true },
        );

        if (!updatedTicket) {
          throw new BadRequestException('No se encontró el ticket para actualizar archivos.');
        }
        ticketInstance = updatedTicket;
      }
      //8.- Se genera el correoData
      const correoData = {
        idTicket: 'X',
        correoUsuario: asignado?.Correo,
        correoCliente: cliente?.Correo,
        extensionCliente: cliente?.Extension,
        descripcionTicket: savedTicket.Descripcion,
        nombreCliente: cliente?.Nombre,
        telefonoCliente: cliente?.Telefono,
        ubicacion: cliente?.Ubicacion,
        area: cliente?.direccion_area?.direccion_area,
      };
      console.log('CorreoData', correoData);
      //9.- Enviar correos
      const channel = 'channel_crearTicket';
      const correo = await this.correoService.enviarCorreo(correoData, channel, token);
      if (correo) {
        console.log('Mensaje enviado al email service');
      }
      return savedTicket;
    } catch (error) {
      console.error('Error al crear el Ticket', error.message);
      throw new BadRequestException('Error interno del servidor.');
    }
  }

  async marcarTicketPendiente(_id: string, user: { userId: string, nombre: string }, cuerpoCorreo: string, emails_extra: string[], files: Express.Multer.File[], token: string): Promise<Ticket> {
    try {
      const resultEstado = await this.getticketsService.getIdEstadoTicket("PENDIENTES");

      if (!resultEstado) {
        throw new NotFoundException("No se encontro el estado del ticket.");
      }

      const { userId, nombre } = user;

      const result = await this.ticketModel.findOneAndUpdate(
        { _id },
        { $set: { Estado: resultEstado._id }, $push: { Historia_ticket: { Nombre: userId, Titulo: "Ticket Pendiente", Mensaje: `Ticket marcado como pendiente. ${nombre} se ha puesto en contacto mediante correo electrónico con el cliente. Mensaje incluido en el correo: <${cuerpoCorreo}>`, stopper: true } } },
        { new: true }
      )

      if (!result) {
        throw new BadRequestException("No se pudo actualizar el ticket.");
      }

      const cliente = await this.clienteModel.findById(result.Cliente).select("Nombre Correo");

      if (!cliente) {
        throw new NotFoundException("No se encontró la informacion del cliente.");
      }


      const formData = new FormData();

      const correoData = {
        details: cuerpoCorreo,
        idTicket: result.Id,
        destinatario: cliente.Correo,
        emails_extra,
      }

      formData.append("correoData", JSON.stringify(correoData));

      if (files.length > 0) {
        files.forEach((file) => {
          const buffer = fs.readFileSync(file.path);
          formData.append('files', buffer, file.originalname);
        });
      }

      const response = await this.correoService.enviarCorreoHTTP(formData, "pendiente", _id, token)

      if (response.success) {
        return response.data;
      } else {
        console.error(
          "⚠️    Hubo un problema al enviar el correo:", response.data.message || response.data);
      }
      throw new BadRequestException("Ocurrio un error al enviar al correo.");
    } catch (error) {
      console.error('Error al marcar el ticket como pendiente', error);
      throw new InternalServerErrorException('Error interno del servidor.');
    }
  }

  async contactarCliente(_id: string, user: { userId: string, nombre: string }, cuerpoCorreo: string, emails_extra: string[], files: Express.Multer.File[], token: string): Promise<Ticket> {
    try {
      const { userId, nombre } = user;

      const result = await this.ticketModel.findOneAndUpdate(
        { _id },
        { $set: { Fecha_hora_ultima_modificacion: obtenerFechaActual() }, $push: { Historia_ticket: { Nombre: userId, Titulo: "Contacto con el cliente", Mensaje: `${nombre} se ha puesto en contacto mediante correo electrónico con el cliente. Cuerpo del correo: <${cuerpoCorreo}>`, stopper: false } } },
        { new: true }
      )

      if (!result) {
        throw new BadRequestException("No se pudo contactar al cliente.");
      }

      const cliente = await this.clienteModel.findById(result.Cliente).select("Nombre Correo");

      if (!cliente) {
        throw new NotFoundException("No se encontró la informacion del cliente.");
      }


      const formData = new FormData();

      const correoData = {
        details: cuerpoCorreo,
        idTicket: result.Id,
        destinatario: cliente.Correo,
        emails_extra,
      }

      formData.append("correoData", JSON.stringify(correoData));

      if (files.length > 0) {
        files.forEach((file) => {
          const buffer = fs.readFileSync(file.path);
          formData.append('files', buffer, file.originalname);
        });
      }

      const response = await this.correoService.enviarCorreoHTTP(formData, "contactoCliente", _id, token)
      if (response.success) {
        return response.data;
      } else {
        console.error(
          "⚠️    Hubo un problema al enviar el correo:", response.data.message || response.data);
      }
      throw new BadRequestException("Ocurrio un error al enviar al correo.");
    } catch (error) {
      console.error('Error al contactar al cliente', error);
      throw new InternalServerErrorException('Error interno del servidor.');
    }
  }
}
