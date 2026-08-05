import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export const APPOINTMENT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

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
