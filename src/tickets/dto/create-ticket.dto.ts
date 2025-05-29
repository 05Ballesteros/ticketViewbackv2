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
export class CreateTicketDto {
  @IsMongoId()
  Cliente: string;

  @IsMongoId()
  Subcategoria: string;

  @IsString()
  Descripcion: string;

  @IsMongoId()
  Medio: string;

  @IsOptional()
  @IsString()
  NumeroRec_Oficio?: string;

  @IsString()
  Asignado_a: string;

  @IsString()
  Tiempo: number;

  @ValidateNested({ each: true })
    @Type(() => FileDto)
    @IsOptional()
    Files?: FileDto[];

}