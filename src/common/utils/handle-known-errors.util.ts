import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

export function handleKnownErrors(
  error: unknown,
  customMessage = 'Ocurrió un error en el servidor.',
) {
  if (
    error instanceof NotFoundException ||
    error instanceof UnauthorizedException ||
    error instanceof BadRequestException ||
    error instanceof ForbiddenException ||
    error instanceof ConflictException ||
    error instanceof UnprocessableEntityException ||
    error instanceof ServiceUnavailableException
  ) {
    throw error;
  }

  // Puedes loguear aquí si quieres

  throw new InternalServerErrorException(customMessage);
}
