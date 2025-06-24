import {
  IsString,
} from 'class-validator';

export class PendingReasonDto {
  @IsString()
  PendingReason: string;
}
