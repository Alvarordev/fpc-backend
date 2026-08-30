import { ApiProperty } from '@nestjs/swagger';
import {
  AppointmentBeneficiaryType,
  AppointmentModality,
  AppointmentStatus,
} from '../../../database/entities/psychooncology-appointment.entity';

export class PsychooncologyAppointmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ enum: AppointmentBeneficiaryType })
  beneficiaryType!: AppointmentBeneficiaryType;
  @ApiProperty({ format: 'uuid', nullable: true })
  companionId!: string | null;
  @ApiProperty({ nullable: true })
  companionFullName!: string | null;
  @ApiProperty({ format: 'uuid' }) volunteerId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) followUpId!: string | null;
  @ApiProperty({ format: 'uuid' }) availabilityId!: string;
  @ApiProperty({ format: 'email', nullable: true }) patientEmail!:
    string | null;
  @ApiProperty({ format: 'uri', nullable: true }) zoomLink!: string | null;
  @ApiProperty() sessionNumber!: number;
  @ApiProperty() isAdditionalSession!: boolean;
  @ApiProperty({ enum: AppointmentModality }) modality!: AppointmentModality;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty({ format: 'date-time' }) scheduledAt!: Date;
  @ApiProperty({ format: 'date-time', nullable: true })
  completedAt!: Date | null;
  @ApiProperty({ nullable: true }) topicAddressed!: string | null;
  @ApiProperty({ nullable: true }) sessionDetails!: string | null;
  @ApiProperty({ nullable: true }) additionalObservations!: string | null;
  @ApiProperty({ nullable: true }) recommendations!: string | null;
  @ApiProperty({ nullable: true }) referral!: string | null;
  @ApiProperty({ nullable: true }) schedulingNotes!: string | null;
  @ApiProperty({ nullable: true }) noAnswerNote!: string | null;
  @ApiProperty({ nullable: true, minimum: 1, maximum: 5 })
  satisfactionRating!: number | null;
  @ApiProperty({ nullable: true }) satisfactionComment!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
