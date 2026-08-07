import { ApiProperty } from '@nestjs/swagger';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../../database/entities/follow-up.enums';

export class FollowUpResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) subjectPatientId!: string;
  @ApiProperty({ nullable: true }) subjectPatientName!: string | null;
  @ApiProperty({ format: 'uuid' }) interlocutorId!: string;
  @ApiProperty({ format: 'uuid' }) agentId!: string;
  @ApiProperty({ enum: FollowUpType }) type!: FollowUpType;
  @ApiProperty({ enum: FollowUpStatus }) status!: FollowUpStatus;
  @ApiProperty({ enum: FollowUpPurpose }) purpose!: FollowUpPurpose;
  @ApiProperty({ format: 'date-time', nullable: true })
  scheduledAt!: Date | null;
  @ApiProperty({ format: 'date-time', nullable: true })
  completedAt!: Date | null;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) nextFollowUpId!:
    string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
