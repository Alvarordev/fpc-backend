import { ApiProperty } from '@nestjs/swagger';
import { PatientMedicalAppointment } from '../../entities/patient-medical-appointment.entity';

export class PatientMedicalAppointmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  healthCenterId!: string | null;

  @ApiProperty()
  specialty!: string;

  @ApiProperty({ format: 'date', nullable: true })
  appointmentDate!: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  nextAppointmentDate!: string | null;

  @ApiProperty()
  hasReferralSheet!: boolean;

  @ApiProperty({ nullable: true })
  referredTo!: string | null;

  @ApiProperty({ nullable: true })
  difficulties!: string | null;

  @ApiProperty()
  isFirstConsultation!: boolean;

  @ApiProperty()
  isCurrent!: boolean;

  @ApiProperty({ nullable: true })
  changeReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(
    appointment: PatientMedicalAppointment,
  ): PatientMedicalAppointmentResponseDto {
    return {
      id: appointment.id,
      patientId: appointment.patientId,
      followUpId: appointment.followUpId,
      healthCenterId: appointment.healthCenterId,
      specialty: appointment.specialty,
      appointmentDate: appointment.appointmentDate,
      nextAppointmentDate: appointment.nextAppointmentDate,
      hasReferralSheet: appointment.hasReferralSheet,
      referredTo: appointment.referredTo,
      difficulties: appointment.difficulties,
      isFirstConsultation: appointment.isFirstConsultation,
      isCurrent: appointment.isCurrent,
      changeReason: appointment.changeReason,
      createdAt: appointment.createdAt.toISOString(),
    };
  }
}
