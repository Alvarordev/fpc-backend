import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { APPOINTMENT_TIME_PATTERN } from './appointment-time';
import {
  ReminderChannel,
  ReminderLead,
} from '../../../../../database/entities/reminder-delivery.enums';

export class CreateMedicalAppointmentDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsUUID() referredHealthCenterId?: string;
  @IsString() specialty!: string;
  @IsOptional() @IsString() specialtyOther?: string;
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @Matches(APPOINTMENT_TIME_PATTERN) appointmentTime?: string;
  @IsOptional() @IsDateString() nextAppointmentDate?: string;
  @IsOptional() @IsString() @MaxLength(255) nextAppointmentSpecialty?: string;
  @IsOptional() @IsString() nextAppointmentSpecialtyOther?: string;
  @IsOptional() @IsBoolean() hasReferralSheet?: boolean;
  @IsOptional() @IsString() referredTo?: string;
  @IsOptional() @IsString() referralNotProvidedReason?: string;
  @IsOptional() @IsString() difficulties?: string;
  @IsOptional() @IsBoolean() isFirstConsultation?: boolean;
  @IsOptional() @IsBoolean() attendedViaSepa?: boolean;
  @IsOptional() @IsBoolean() referredViaSepa?: boolean;
  // Reminder created for future appointments (defaults: ONE_DAY, EMAIL when
  // the patient has an email).
  @IsOptional() @IsEnum(ReminderLead) reminderLead?: ReminderLead;
  @IsOptional() @IsDateString() reminderAt?: string;
  @IsOptional() @IsEnum(ReminderChannel) reminderChannel?: ReminderChannel;
}
