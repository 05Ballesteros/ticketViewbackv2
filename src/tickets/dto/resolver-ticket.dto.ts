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

export class ResolverTicketDto {
  @IsString()
  @IsOptional()
  Nota: string;

  @IsString()
  Respuesta_cierre_reasignado: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  vistoBueno: boolean;

  @ValidateNested({ each: true })
  @Type(() => FileDto)
  @IsOptional()
  Files?: FileDto[];
}
