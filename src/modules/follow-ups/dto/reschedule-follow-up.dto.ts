import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FollowUpType } from '../../../database/entities/follow-up.enums';

export class RescheduleFollowUpDto {
  @ApiProperty({ format: 'date-time' }) @IsDateString() scheduledAt!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Defaults to the original agent; agents always reschedule to themselves',
  })
  @IsOptional()
  @IsUUID()
  agentId?: string;
  @ApiPropertyOptional({ enum: FollowUpType })
  @IsOptional()
  @IsIn(Object.values(FollowUpType))
  type?: FollowUpType;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
