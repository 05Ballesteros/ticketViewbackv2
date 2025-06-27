import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsMongoId,
  IsNotEmpty,
  ValidateNested
} from 'class-validator';

export class FileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsMongoId()
  @IsNotEmpty()
  _id: string;
}

export class NotaDto {
  @IsString()
  @IsOptional()
  Nota: string;

  @IsOptional()
  Files?: any
}
