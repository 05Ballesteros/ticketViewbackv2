import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsMongoId,
  IsNotEmpty,
  ValidateNested
} from 'class-validator';

export class AceptarSolucionDto {
  @IsString()
  Nombre: string;
}
