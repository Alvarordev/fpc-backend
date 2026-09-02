import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ReminderKind } from '../../../database/entities/reminder-kind.enum';
import { ReminderStatus } from '../../../database/entities/reminder-status.enum';
import { DATE_ONLY_PATTERN } from '../../../shared/date-only/date-only.util';

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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  medicalAppointmentId?: string;
}
