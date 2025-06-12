import { BadRequestException } from '@nestjs/common';

export const generarCorreoData = async (ticket: any) => {
  try {
    console.log('Esta entrando a la función para genarar el correo data', ticket);
    //
    // }
    // req.ticketId = populateResult.Id;
    return true;
  } catch (error) {
    console.log(error);
    throw new BadRequestException('No se pudo generar correoData.');
  }
};
