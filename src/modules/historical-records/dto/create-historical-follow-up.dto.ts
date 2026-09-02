import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../../../database/entities/follow-up.enums';
import { DATE_ONLY_PATTERN } from '../../../shared/date-only/date-only.util';

export class CreateHistoricalFollowUpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectPatientId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  interlocutorId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  agentId!: string;

  @ApiProperty({ enum: FollowUpType })
  @IsIn(Object.values(FollowUpType))
  type!: FollowUpType;

  @ApiProperty({ enum: FollowUpPurpose })
  @IsIn(Object.values(FollowUpPurpose))
  purpose!: FollowUpPurpose;

  @ApiProperty({ enum: FollowUpStatus })
  @IsIn(Object.values(FollowUpStatus))
  status!: FollowUpStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

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

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
