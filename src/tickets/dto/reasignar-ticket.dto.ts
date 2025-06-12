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
export class ReasignarTicketDto {
  @IsString()
  @IsOptional()
  Nota: string;
  
  @IsString()
  Reasignado_a: string;
  
  @IsBoolean()
  @IsOptional()
  vistoBueno: boolean;

  @ValidateNested({ each: true })
  @Type(() => FileDto)
  @IsOptional()
  Files?: FileDto[];

}