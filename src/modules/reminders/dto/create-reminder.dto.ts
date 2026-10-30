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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderKind } from '../../../database/entities/reminder-kind.enum';
import {
  ReminderChannel,
  ReminderLead,
} from '../../../database/entities/reminder-delivery.enums';

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

  @ApiPropertyOptional({
    enum: ReminderChannel,
    description:
      'Defaults to EMAIL for appointment reminders of patients with an email, MANUAL otherwise',
  })
  @IsOptional()
  @IsEnum(ReminderChannel)
  channel?: ReminderChannel;

  @ApiPropertyOptional({
    enum: ReminderLead,
    description:
      'How long before the appointment (dueAt) to remind. Defaults to ONE_DAY. Only for MEDICAL_APPOINTMENT reminders.',
  })
  @IsOptional()
  @IsEnum(ReminderLead)
  lead?: ReminderLead;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Required when lead is CUSTOM. For GENERIC reminders defaults to dueAt.',
  })
  @IsOptional()
  @IsDateString()
  remindAt?: string;
}
