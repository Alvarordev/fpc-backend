import { ApiProperty } from '@nestjs/swagger';
import {
  FollowUpAttemptOutcome,
  FollowUpType,
} from '../../../database/entities/follow-up.enums';

export class FollowUpAttemptResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty({ enum: FollowUpType }) channel!: FollowUpType;
  @ApiProperty({ enum: FollowUpAttemptOutcome })
  outcome!: FollowUpAttemptOutcome;
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
  @ApiProperty({ format: 'uuid', nullable: true }) actorUserId!: string | null;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}
