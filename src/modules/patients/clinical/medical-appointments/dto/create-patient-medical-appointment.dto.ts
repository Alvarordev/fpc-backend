import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { APPOINTMENT_TIME_PATTERN } from './appointment-time';

export class CreatePatientMedicalAppointmentDto {
  @IsUUID() followUpId!: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsString() specialty!: string;
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @Matches(APPOINTMENT_TIME_PATTERN) appointmentTime?: string;
  @IsOptional() @IsDateString() nextAppointmentDate?: string;
  @IsOptional() @IsBoolean() hasReferralSheet?: boolean;
  @IsOptional() @IsString() referredTo?: string;
  @IsOptional() @IsString() difficulties?: string;
  @IsOptional() @IsBoolean() isFirstConsultation?: boolean;
  @IsOptional() @IsString() changeReason?: string;
}
