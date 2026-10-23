import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AppointmentModality } from '../../../../../database/entities/psychooncology-appointment.entity';

export class CreatePatientPsychooncologySupportAssessmentDto {
  @IsUUID() followUpId!: string;

  @IsOptional() @IsBoolean() excessiveWorry?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(10) emotionalDistressScore?: number;

  @IsOptional()
  @IsIn(Object.values(AppointmentModality))
  preferredModality?: AppointmentModality;
}
