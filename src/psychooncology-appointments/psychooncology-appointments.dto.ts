import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  AppointmentModality,
  AppointmentStatus,
} from '../database/entities/psychooncology-appointment.entity';

export class CreatePsychooncologyAppointmentDto {
  @IsUUID() patientId!: string;
  @IsUUID() availabilityId!: string;
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsString() patientEmail?: string;
  @IsOptional() @IsBoolean() isAdditionalSession?: boolean;
  @IsIn(Object.values(AppointmentModality)) modality!: AppointmentModality;
}

export class UpdatePsychooncologyAppointmentDto {
  @IsOptional()
  @IsIn(Object.values(AppointmentStatus))
  status?: AppointmentStatus;
  @IsOptional() @IsString() patientEmail?: string;
  @IsOptional() @IsBoolean() isAdditionalSession?: boolean;
  @IsOptional() @IsString() topicAddressed?: string;
  @IsOptional() @IsString() sessionDetails?: string;
  @IsOptional() @IsString() additionalObservations?: string;
  @IsOptional() @IsString() recommendations?: string;
  @IsOptional() @IsString() referral?: string;
}
