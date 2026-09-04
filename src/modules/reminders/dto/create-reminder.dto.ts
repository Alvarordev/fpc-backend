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
import { ReminderKind } from '../../../database/entities/reminder-kind.enum';

export class CreateReminderMedicalAppointmentDto {
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsString() @MaxLength(255) specialty!: string;
  @IsOptional() @IsBoolean() isFirstConsultation?: boolean;
}

export class CreateReminderDto {
  @IsUUID() subjectPatientId!: string;
  @IsDateString() dueAt!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() assignedAgentId?: string;
  @IsOptional() @IsUUID() createdFromFollowUpId?: string;
  @IsOptional() @IsEnum(ReminderKind) kind?: ReminderKind;
  @ValidateIf(
    (dto: CreateReminderDto) => dto.kind === ReminderKind.MEDICAL_APPOINTMENT,
  )
  @ValidateNested()
  @Type(() => CreateReminderMedicalAppointmentDto)
  medicalAppointment?: CreateReminderMedicalAppointmentDto;
}
