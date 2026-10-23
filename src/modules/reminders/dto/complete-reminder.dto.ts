import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MedicalAppointmentStatus } from '../../../database/entities/medical-appointment-status.enum';

export class CompleteReminderMedicalAppointmentDto {
  @IsEnum(MedicalAppointmentStatus)
  status!: MedicalAppointmentStatus;

  @IsOptional() @IsBoolean() hasReferralSheet?: boolean;
  @IsOptional() @IsString() referredTo?: string;
  @IsOptional() @IsString() referralNotProvidedReason?: string;
  @IsOptional() @IsString() difficulties?: string;
  @IsOptional() @IsDateString() nextAppointmentDate?: string;
  @IsOptional() @IsString() @MaxLength(255) nextAppointmentSpecialty?: string;
  @IsOptional() @IsBoolean() attendedViaSepa?: boolean;
  @IsOptional() @IsBoolean() referredViaSepa?: boolean;
  @IsString() changeReason!: string;
}

export class CompleteReminderDto {
  @IsOptional() @IsUUID() resultingFollowUpId?: string;

  @ValidateIf(
    (dto: CompleteReminderDto) => dto.medicalAppointment !== undefined,
  )
  @ValidateNested()
  @Type(() => CompleteReminderMedicalAppointmentDto)
  medicalAppointment?: CompleteReminderMedicalAppointmentDto;
}
