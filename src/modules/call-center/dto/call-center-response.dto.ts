import { ApiProperty } from '@nestjs/swagger';
import {
  FollowUpPurpose,
  FollowUpType,
} from '../../../database/entities/follow-up.enums';

export class CallCenterAgentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
}

export class CallCenterFollowUpDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) subjectPatientId!: string;
  @ApiProperty() subjectPatientName!: string;
  @ApiProperty({ format: 'uuid' }) agentId!: string;
  @ApiProperty({ enum: FollowUpType }) type!: FollowUpType;
  @ApiProperty({ enum: FollowUpPurpose }) purpose!: FollowUpPurpose;
  @ApiProperty({ format: 'date-time', nullable: true })
  scheduledAt!: Date | null;
}

export class CallCenterReminderDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) subjectPatientId!: string;
  @ApiProperty() subjectPatientName!: string;
  @ApiProperty({ format: 'uuid' }) assignedAgentId!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ format: 'date-time' }) dueAt!: Date;
}

export class CallCenterWorkloadResponseDto {
  @ApiProperty({ type: CallCenterAgentDto, isArray: true })
  agents!: CallCenterAgentDto[];
  @ApiProperty({ type: CallCenterFollowUpDto, isArray: true })
  scheduledFollowUps!: CallCenterFollowUpDto[];
  @ApiProperty({ type: CallCenterReminderDto, isArray: true })
  pendingReminders!: CallCenterReminderDto[];
}
