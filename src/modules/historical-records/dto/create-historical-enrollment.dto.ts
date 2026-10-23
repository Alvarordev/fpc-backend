import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  FollowUpStatus,
  FollowUpType,
} from '../../../database/entities/follow-up.enums';
import { CreateEnrollmentDto } from '../../enrollments/dto/create-enrollment.dto';
import { DATE_ONLY_PATTERN } from '../../../shared/date-only/date-only.util';
import { CreateHistoricalPatientDto } from './create-historical-patient.dto';

export class HistoricalEnrollmentFollowUpDto {
  @ApiProperty({ enum: FollowUpType })
  @IsIn(Object.values(FollowUpType))
  type!: FollowUpType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  agentId!: string;

  @ApiProperty({ enum: FollowUpStatus })
  @IsIn(Object.values(FollowUpStatus))
  status!: FollowUpStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  scheduledOn?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  completedOn?: string;
}

export class CreateHistoricalEnrollmentDto extends OmitType(
  CreateEnrollmentDto,
  ['followUp', 'patient'] as const,
) {
  @ApiPropertyOptional({ type: CreateHistoricalPatientDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateHistoricalPatientDto)
  patient?: CreateHistoricalPatientDto;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  enrolledOn!: string;

  @ApiProperty({ type: HistoricalEnrollmentFollowUpDto })
  @ValidateNested()
  @Type(() => HistoricalEnrollmentFollowUpDto)
  followUp!: HistoricalEnrollmentFollowUpDto;
}

export type HistoricalEnrollmentInput = CreateHistoricalEnrollmentDto & {
  patientId?: string;
  patient?: CreateHistoricalPatientDto;
  enrolledOn: string;
  followUp: HistoricalEnrollmentFollowUpDto;
};
