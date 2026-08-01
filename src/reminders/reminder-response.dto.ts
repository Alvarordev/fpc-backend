import { ApiProperty } from '@nestjs/swagger';
import { ReminderStatus } from '../database/entities/reminder-status.enum';

export class ReminderResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) subjectPatientId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) createdFromFollowUpId!:
    string | null;
  @ApiProperty({ format: 'uuid' }) assignedAgentId!: string;
  @ApiProperty({ format: 'date-time' }) dueAt!: Date;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: ReminderStatus }) status!: ReminderStatus;
  @ApiProperty({ format: 'date-time', nullable: true })
  completedAt!: Date | null;
  @ApiProperty({ format: 'uuid', nullable: true }) resultingFollowUpId!:
    string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}
