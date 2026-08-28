import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { APPOINTMENT_TIME_PATTERN } from './appointment-time';

/**
 * `specialty` is deliberately absent: the current-record versioning
 * (patientId, specialty) uniquely identifies which row this update
 * replaces, so changing it would orphan the old "current" row. Create a
 * new appointment instead.
 */
export class UpdateMedicalAppointmentDto {
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @Matches(APPOINTMENT_TIME_PATTERN) appointmentTime?: string;
  @IsOptional() @IsDateString() nextAppointmentDate?: string;
  @IsOptional() @IsBoolean() hasReferralSheet?: boolean;
  @IsOptional() @IsString() referredTo?: string;
  @IsOptional() @IsString() referralNotProvidedReason?: string;
  @IsOptional() @IsString() difficulties?: string;
  @IsOptional() @IsBoolean() isFirstConsultation?: boolean;
  @IsString() @IsNotEmpty() changeReason!: string;
}
