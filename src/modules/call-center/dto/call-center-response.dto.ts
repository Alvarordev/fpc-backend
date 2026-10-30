import { ApiProperty } from '@nestjs/swagger';
import {
  FollowUpPurpose,
  FollowUpStatus,
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
  @ApiProperty() patientHasEmail!: boolean;
  @ApiProperty({ format: 'uuid' }) agentId!: string;
  @ApiProperty({ enum: [FollowUpStatus.SCHEDULED, FollowUpStatus.OVERDUE] })
  status!: FollowUpStatus;
  @ApiProperty({ enum: FollowUpType }) type!: FollowUpType;
  @ApiProperty({ enum: FollowUpPurpose }) purpose!: FollowUpPurpose;
  @ApiProperty({ format: 'date-time', nullable: true })
  scheduledAt!: Date | null;
  @ApiProperty({ format: 'date', nullable: true })
  scheduledOn!: string | null;
}

export class CallCenterReminderDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) subjectPatientId!: string;
  @ApiProperty() subjectPatientName!: string;
  @ApiProperty() patientHasEmail!: boolean;
  @ApiProperty({ format: 'uuid' }) assignedAgentId!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) dueAt!: Date | null;
  @ApiProperty({ format: 'date', nullable: true }) dueOn!: string | null;
}

export class CallCenterPendingCountsDto {
  @ApiProperty({ description: 'Due today (America/Lima)' }) today!: number;
  @ApiProperty({ description: 'Due from today through Sunday' })
  week!: number;
  @ApiProperty({ description: 'Due before today and still pending' })
  overdue!: number;
}

export class CallCenterAgentLoadDto {
  @ApiProperty({ format: 'uuid' }) agentId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: CallCenterPendingCountsDto })
  followUps!: CallCenterPendingCountsDto;
  @ApiProperty({ type: CallCenterPendingCountsDto })
  reminders!: CallCenterPendingCountsDto;
}

export class CallCenterWorkloadResponseDto {
  @ApiProperty({ type: CallCenterAgentDto, isArray: true })
  agents!: CallCenterAgentDto[];
  @ApiProperty({ format: 'date' }) today!: string;
  @ApiProperty({ format: 'date', description: 'Sunday of the current week' })
  weekEnd!: string;
  @ApiProperty({ type: CallCenterAgentLoadDto, isArray: true })
  load!: CallCenterAgentLoadDto[];
  @ApiProperty({
    type: CallCenterFollowUpDto,
    isArray: true,
    description: 'Scheduled and overdue follow-ups',
  })
  scheduledFollowUps!: CallCenterFollowUpDto[];
  @ApiProperty({ type: CallCenterReminderDto, isArray: true })
  pendingReminders!: CallCenterReminderDto[];
}
