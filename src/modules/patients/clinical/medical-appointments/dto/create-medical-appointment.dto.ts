import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { APPOINTMENT_TIME_PATTERN } from './appointment-time';

export class CreateMedicalAppointmentDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsString() specialty!: string;
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @Matches(APPOINTMENT_TIME_PATTERN) appointmentTime?: string;
  @IsOptional() @IsDateString() nextAppointmentDate?: string;
  @IsOptional() @IsString() @MaxLength(255) nextAppointmentSpecialty?: string;
  @IsOptional() @IsBoolean() hasReferralSheet?: boolean;
  @IsOptional() @IsString() referredTo?: string;
  @IsOptional() @IsString() referralNotProvidedReason?: string;
  @IsOptional() @IsString() difficulties?: string;
  @IsOptional() @IsBoolean() isFirstConsultation?: boolean;
}
