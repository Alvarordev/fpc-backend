import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { AppointmentModality } from '../../../database/entities/psychooncology-appointment.entity';

export class CreatePsychooncologyAppointmentDto {
  @IsUUID() patientId!: string;
  @IsUUID() availabilityId!: string;
  @IsOptional() @IsUUID() followUpId?: string;
  @IsOptional() @IsString() patientEmail?: string;
  @IsOptional() @IsBoolean() isAdditionalSession?: boolean;
  @IsIn(Object.values(AppointmentModality)) modality!: AppointmentModality;
}
