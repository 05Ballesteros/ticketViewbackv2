import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import FormData = require('form-data');

@Injectable()
export class CorreoService {
    async enviarCorreo(correoData: any, channel: string, token: any) {
        try {
            const url = 'http://emails:8000/api/v1/redis/publish';
            if (typeof channel !== 'string') {
                throw new BadRequestException('El canal debe ser una cadena.');
            }

            const message = {
                channel: channel,
                message: correoData,
            };

            // Enviar solicitud HTTP
            const response = await axios.post(
                url, message,
                {
                    headers: {
                        Authorization: `Bearer ${token}`, // Cabecera de autenticación
                    },
                },
            );
            const responseMessage =
                channel === 'channel_crearTicket'
                    ? `Se creó el ticket con número ${correoData.idTicket}`
                    : `Acción realizada correctamente para el ticket con número #${correoData.idTicket}`;
            return { desc: responseMessage, data: response.data };
        } catch (error) {
            console.error('Error al enviar el correo:', error);
            throw new BadRequestException('Error al enviar el correo.');
        }
    }

    async enviarCorreoHTTP(formData: FormData, endpoint: string, _id: string, token: any) {
    try {
      const response = await axios.post(
        `http://emails:8000/api/v1/email/${endpoint}/${_id}`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 201 && response.data.success) {
        return response.data;
      } else {
        console.error(
          '⚠️    Hubo un problema al enviar el correo:',
          response.data.message || response.data,
        );
      }
      throw new BadRequestException('Ocurrio un error al enviar al correo.');
    } catch (error) {
      console.error('Error al enviar el correo:', error);
      throw new BadRequestException('Error al enviar el correo.');
    }
  }
}
