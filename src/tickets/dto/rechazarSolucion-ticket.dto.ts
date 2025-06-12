import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsMongoId,
  IsNotEmpty,
  ValidateNested
} from 'class-validator';

export class RechazarSolucionDto {
  @IsString()
  Nombre: string;

  @IsString()
  feedback: string;
}
