import { MedicalAppointmentStatus } from '../../../../../database/entities/medical-appointment-status.enum';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { APPOINTMENT_TIME_PATTERN } from './appointment-time';

export class CreatePatientMedicalAppointmentDto {
  @IsUUID() followUpId!: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsUUID() referredHealthCenterId?: string;
  @IsString() specialty!: string;
  @IsOptional() @IsString() specialtyOther?: string;
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @Matches(APPOINTMENT_TIME_PATTERN) appointmentTime?: string;
  @IsOptional() @IsDateString() nextAppointmentDate?: string;
  @IsOptional() @IsString() @MaxLength(255) nextAppointmentSpecialty?: string;
  @IsOptional() @IsString() nextAppointmentSpecialtyOther?: string;
  @IsOptional() @IsBoolean() hasReferralSheet?: boolean | null;
  @IsOptional() @IsString() referredTo?: string;
  @IsOptional() @IsString() referralNotProvidedReason?: string;
  @IsOptional() @IsString() difficulties?: string;
  @IsOptional() @IsBoolean() isFirstConsultation?: boolean;
  @IsOptional() @IsString() changeReason?: string;
  @IsOptional() @IsBoolean() attendedViaSepa?: boolean;
  @IsOptional() @IsBoolean() referredViaSepa?: boolean;
  @IsOptional()
  @IsIn(Object.values(MedicalAppointmentStatus))
  status?: MedicalAppointmentStatus;
}
