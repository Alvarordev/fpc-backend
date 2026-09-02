import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicalAppointmentStatus } from '../../../database/entities/medical-appointment-status.enum';
import { ReminderKind } from '../../../database/entities/reminder-kind.enum';
import { ReminderStatus } from '../../../database/entities/reminder-status.enum';

export class ReminderMedicalAppointmentSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() specialty!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) healthCenterId!:
    string | null;
  @ApiProperty({ nullable: true }) healthCenterName!: string | null;
  @ApiProperty({ format: 'date', nullable: true }) appointmentDate!:
    string | null;
  @ApiProperty({ nullable: true }) appointmentTime!: string | null;
  @ApiProperty({ enum: MedicalAppointmentStatus })
  status!: MedicalAppointmentStatus;
  @ApiProperty() isFirstConsultation!: boolean;
}

export class ReminderResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) subjectPatientId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) createdFromFollowUpId!:
    string | null;
  @ApiProperty({ format: 'uuid' }) assignedAgentId!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) dueAt!: Date | null;
  @ApiProperty({ format: 'date', nullable: true }) dueOn!: string | null;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: ReminderKind }) kind!: ReminderKind;
  @ApiProperty({ format: 'uuid', nullable: true }) medicalAppointmentId!:
    string | null;
  @ApiPropertyOptional({ type: ReminderMedicalAppointmentSummaryDto })
  medicalAppointment?: ReminderMedicalAppointmentSummaryDto | null;
  @ApiProperty({ enum: ReminderStatus }) status!: ReminderStatus;
  @ApiProperty({ format: 'date-time', nullable: true })
  completedAt!: Date | null;
  @ApiProperty({ format: 'date', nullable: true })
  completedOn!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) resultingFollowUpId!:
    string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty() isHistorical!: boolean;
}
