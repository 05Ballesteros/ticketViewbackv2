// import { PartialType } from '@nestjs/mapped-types';
// //import { CreateTareaDto } from './create-ticket.dto';
// import { IsBoolean, IsDateString, IsEmail, IsMongoId, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
// import { Type } from 'class-transformer';

// class FileDto {
//     @IsString()
//     @IsNotEmpty()
//     name: string;

//     @IsString()
//     @IsNotEmpty()
//     url: string;

//     @IsMongoId()
//     @IsNotEmpty()
//     _id: string;
//   }

// export class UpdateTareaDto extends PartialType(CreateTareaDto) {
//     @IsMongoId()
//     @IsOptional()
//     Estado?: string;

//     @IsMongoId()
//     @IsOptional()
//     Area?: string;

//     @IsMongoId()
//     @IsOptional()
//     Creado_por?: string;

//     @IsString()
//     @IsOptional()
//     Descripcion?: string;

//     @IsDateString()
//     @IsOptional()
//     Fecha_hora_resolucion?: string;

//     @IsMongoId()
//     @IsOptional()
//     Asignado_a?: string;

//     @IsMongoId()
//     @IsOptional()
//     Reasignado_a?: string;

//     @ValidateNested({ each: true })
//     @Type(() => FileDto)
//     @IsOptional()
//     Files?: FileDto[];

//     @IsMongoId()
//     @IsOptional()
//     IdTicket?: string;

//     @IsString()
//     @IsOptional()
//     Id?: string;
//   }
