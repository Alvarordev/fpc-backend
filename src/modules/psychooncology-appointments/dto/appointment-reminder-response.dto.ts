import { ApiProperty } from '@nestjs/swagger';
import { AppointmentReminderMode } from '../../../database/entities/psychooncology-appointment.entity';

export class AppointmentReminderResponseDto {
  @ApiProperty({ format: 'uuid' }) appointmentId!: string;
  @ApiProperty({ description: 'Ready-to-copy reminder text for the patient' })
  message!: string;
  @ApiProperty({ enum: AppointmentReminderMode })
  reminderMode!: AppointmentReminderMode;
  @ApiProperty({ format: 'date-time', nullable: true }) remindAt!: Date | null;
  @ApiProperty({ format: 'date-time', nullable: true })
  reminderSentAt!: Date | null;
}
