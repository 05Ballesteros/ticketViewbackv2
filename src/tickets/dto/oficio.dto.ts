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

export class OficioDto {
  @IsString()
  @IsOptional()
  Numero_Oficio: string;

  @ValidateNested({ each: true })
  @Type(() => FileDto)
  @IsOptional()
  Files?: FileDto[];
}
