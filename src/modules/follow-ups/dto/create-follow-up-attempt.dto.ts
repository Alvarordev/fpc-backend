import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import {
  FollowUpAttemptOutcome,
  FollowUpType,
} from '../../../database/entities/follow-up.enums';

export class CreateFollowUpAttemptDto {
  @ApiProperty({ enum: FollowUpType })
  @IsIn(Object.values(FollowUpType))
  channel!: FollowUpType;
  @ApiProperty({ enum: FollowUpAttemptOutcome })
  @IsIn(Object.values(FollowUpAttemptOutcome))
  outcome!: FollowUpAttemptOutcome;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Defaults to now',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
