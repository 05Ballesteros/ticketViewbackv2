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
export class CerrarTicketDto {

  @IsString()
  Descripcion_cierre: string;

  @ValidateNested({ each: true })
  @Type(() => FileDto)
  @IsOptional()
  Files?: FileDto[];

}