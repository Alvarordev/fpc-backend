import { ApiProperty } from '@nestjs/swagger';
import { PatientSymptomReport } from '../entities/patient-symptom-report.entity';

export class PatientSymptomReportResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  enrollmentId!: string | null;

  @ApiProperty({ nullable: true })
  discomfortSeverity!: string | null;

  @ApiProperty({ nullable: true })
  discomfortDescription!: string | null;

  @ApiProperty({ nullable: true })
  symptomDuration!: string | null;

  @ApiProperty({ nullable: true })
  symptomFrequency!: string | null;

  @ApiProperty({ nullable: true })
  isPainPresent!: boolean | null;

  @ApiProperty({ minimum: 0, maximum: 10, nullable: true })
  painIntensity!: number | null;

  @ApiProperty({ nullable: true })
  painLocation!: string | null;

  @ApiProperty({ nullable: true })
  painDescription!: string | null;

  @ApiProperty()
  hasSoughtMedicalConsultation!: boolean;

  @ApiProperty({ format: 'uuid', nullable: true })
  healthCenterId!: string | null;

  @ApiProperty({ nullable: true })
  specialty!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(report: PatientSymptomReport): PatientSymptomReportResponseDto {
    return {
      id: report.id,
      patientId: report.patientId,
      followUpId: report.followUpId,
      enrollmentId: report.enrollmentId,
      discomfortSeverity: report.discomfortSeverity,
      discomfortDescription: report.discomfortDescription,
      symptomDuration: report.symptomDuration,
      symptomFrequency: report.symptomFrequency,
      isPainPresent: report.isPainPresent,
      painIntensity: report.painIntensity,
      painLocation: report.painLocation,
      painDescription: report.painDescription,
      hasSoughtMedicalConsultation: report.hasSoughtMedicalConsultation,
      healthCenterId: report.healthCenterId,
      specialty: report.specialty,
      createdAt: report.createdAt.toISOString(),
    };
  }
}
