import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MedicalAppointmentStatus } from '../../../database/entities/medical-appointment-status.enum';
import { ReminderKind } from '../../../database/entities/reminder-kind.enum';
import { ReminderStatus } from '../../../database/entities/reminder-status.enum';
import { DATE_ONLY_PATTERN } from '../../../shared/date-only/date-only.util';
import { APPOINTMENT_TIME_PATTERN } from '../../patients/clinical/medical-appointments/dto/appointment-time';
import { CreateHistoricalMedicalAppointmentDto } from './create-historical-medical-appointment.dto';

/** Nested appointment payload when creating a MEDICAL_APPOINTMENT reminder historically. */
export class HistoricalReminderMedicalAppointmentDto extends OmitType(
  CreateHistoricalMedicalAppointmentDto,
  ['patientId', 'followUpId'] as const,
) {}

export class CreateHistoricalReminderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectPatientId!: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  dueOn?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  completedOn?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assignedAgentId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  createdFromFollowUpId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  resultingFollowUpId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ enum: ReminderKind })
  @IsOptional()
  @IsEnum(ReminderKind)
  kind?: ReminderKind;

  @ApiProperty({ enum: ReminderStatus })
  @IsEnum(ReminderStatus)
  status!: ReminderStatus;

  /** Prefer nested medicalAppointment for new historical medical reminders. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  medicalAppointmentId?: string;

  @ApiPropertyOptional({ type: HistoricalReminderMedicalAppointmentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HistoricalReminderMedicalAppointmentDto)
  medicalAppointment?: HistoricalReminderMedicalAppointmentDto;
}

export class UpdateHistoricalReminderDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  dueOn?: string | null;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  completedOn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: ReminderStatus })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  createdFromFollowUpId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  resultingFollowUpId?: string | null;

  @ApiPropertyOptional({ type: HistoricalReminderMedicalAppointmentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HistoricalReminderMedicalAppointmentDto)
  medicalAppointment?: HistoricalReminderMedicalAppointmentDto;
}
