import { ApiProperty } from '@nestjs/swagger';
import { MedicalAppointmentStatus } from '../../../../../database/entities/medical-appointment-status.enum';
import { PatientMedicalAppointment } from '../../../../../database/entities/patient-medical-appointment.entity';

export class MedicalAppointmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() patientFullName!: string;
  @ApiProperty({ nullable: true }) patientDni!: string | null;
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) healthCenterId!:
    string | null;
  @ApiProperty({ nullable: true }) healthCenterName!: string | null;
  @ApiProperty() specialty!: string;
  @ApiProperty({ format: 'date', nullable: true })
  appointmentDate!: string | null;
  @ApiProperty({ nullable: true, description: 'HH:mm or HH:mm:ss' })
  appointmentTime!: string | null;
  @ApiProperty({ format: 'date', nullable: true })
  nextAppointmentDate!: string | null;
  @ApiProperty({ nullable: true })
  nextAppointmentSpecialty!: string | null;
  @ApiProperty({ nullable: true }) hasReferralSheet!: boolean | null;
  @ApiProperty({ nullable: true }) referredTo!: string | null;
  @ApiProperty({ nullable: true }) referralNotProvidedReason!: string | null;
  @ApiProperty({ nullable: true }) difficulties!: string | null;
  @ApiProperty() isFirstConsultation!: boolean;
  @ApiProperty({ nullable: true }) attendedViaSepa!: boolean | null;
  @ApiProperty({ nullable: true }) referredViaSepa!: boolean | null;
  @ApiProperty({ enum: MedicalAppointmentStatus })
  status!: MedicalAppointmentStatus;
  @ApiProperty({ format: 'uuid', nullable: true }) reminderId!: string | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty({ nullable: true }) changeReason!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;

  static from(
    appointment: PatientMedicalAppointment,
  ): MedicalAppointmentResponseDto {
    return {
      id: appointment.id,
      patientId: appointment.patientId,
      patientFullName: appointment.patient.fullName,
      patientDni: appointment.patient.dni,
      followUpId: appointment.followUpId,
      healthCenterId: appointment.healthCenterId,
      healthCenterName: appointment.healthCenter?.name ?? null,
      specialty: appointment.specialty,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      nextAppointmentDate: appointment.nextAppointmentDate,
      nextAppointmentSpecialty: appointment.nextAppointmentSpecialty,
      hasReferralSheet: appointment.hasReferralSheet,
      referredTo: appointment.referredTo,
      referralNotProvidedReason: appointment.referralNotProvidedReason,
      difficulties: appointment.difficulties,
      isFirstConsultation: appointment.isFirstConsultation,
      attendedViaSepa: appointment.attendedViaSepa,
      referredViaSepa: appointment.referredViaSepa,
      status: appointment.status,
      reminderId: appointment.reminderId,
      isCurrent: appointment.isCurrent,
      changeReason: appointment.changeReason,
      createdAt: appointment.createdAt,
    };
  }
}

export class MedicalAppointmentListResponseDto {
  @ApiProperty({ type: MedicalAppointmentResponseDto, isArray: true })
  data!: MedicalAppointmentResponseDto[];
  @ApiProperty() total!: number;
}
