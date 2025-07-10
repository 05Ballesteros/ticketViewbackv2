import { Type } from 'class-transformer';
import { IsString, IsBoolean, IsDate, IsArray, IsOptional, IsMongoId, IsNumber, IsNotEmpty, ValidateNested } from 'class-validator';

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

export class RegresarTicketMesaDto {
  @IsString()
  descripcion_retorno: string;

  @ValidateNested({ each: true })
  @Type(() => FileDto)
  @IsOptional()
  Files?: FileDto[];
}

export class RegresarTicketModeradorDto {
  @IsString()
  descripcion_retorno: string;

  @ValidateNested({ each: true })
  @Type(() => FileDto)
  @IsOptional()
  Files?: FileDto[];
}

export class RegresarTicketResolutorDto {
  @IsString()
  Descripcion_respuesta_cliente: string;

  @IsString()
  Reasignado_a: string;

  @ValidateNested({ each: true })
  @Type(() => FileDto)
  @IsOptional()
  Files?: FileDto[];

}