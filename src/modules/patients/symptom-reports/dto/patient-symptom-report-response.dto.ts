import { ApiProperty } from '@nestjs/swagger';
import { PatientSymptomReport } from '../../../../database/entities/patient-symptom-report.entity';
import { DurationResponseDto } from '../../../../shared/duration/duration-response.dto';
import { MedicalConsultationStatus } from '../../../../database/entities/medical-consultation-status.enum';

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
  hasDiscomfort!: boolean | null;

  @ApiProperty({ nullable: true })
  checkupMotivation!: string | null;

  @ApiProperty({ nullable: true })
  signsAndSymptoms!: string | null;

  @ApiProperty({ nullable: true })
  indicationsReceived!: string | null;

  @ApiProperty({ type: DurationResponseDto, nullable: true })
  symptomDuration!: DurationResponseDto | null;

  @ApiProperty({ type: DurationResponseDto, nullable: true })
  symptomFrequency!: DurationResponseDto | null;

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

  @ApiProperty({ nullable: true })
  hasRequestedMedicalConsultation!: boolean | null;

  @ApiProperty({ enum: MedicalConsultationStatus, nullable: true })
  consultationStatus!: MedicalConsultationStatus | null;

  @ApiProperty({ nullable: true })
  consultationNotObtainedReason!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  healthCenterId!: string | null;

  @ApiProperty({ nullable: true })
  specialty!: string | null;

  @ApiProperty({ type: DurationResponseDto, nullable: true })
  diagnosisSearchDuration!: DurationResponseDto | null;

  @ApiProperty({ nullable: true })
  hasReceivedDiagnosis!: boolean | null;

  @ApiProperty({ nullable: true })
  reportedDiagnosis!: string | null;

  @ApiProperty({ nullable: true })
  isReceivingReportedTreatment!: boolean | null;

  @ApiProperty({ nullable: true })
  reportedTreatment!: string | null;

  @ApiProperty({ type: DurationResponseDto, nullable: true })
  reportedTreatmentFrequency!: DurationResponseDto | null;

  @ApiProperty({ nullable: true })
  notReceivingTreatmentReason!: string | null;

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
      hasDiscomfort: report.hasDiscomfort,
      checkupMotivation: report.checkupMotivation,
      signsAndSymptoms: report.signsAndSymptoms,
      indicationsReceived: report.indicationsReceived,
      symptomDuration: DurationResponseDto.from(report.symptomDuration),
      symptomFrequency: DurationResponseDto.from(report.symptomFrequency),
      isPainPresent: report.isPainPresent,
      painIntensity: report.painIntensity,
      painLocation: report.painLocation,
      painDescription: report.painDescription,
      hasSoughtMedicalConsultation: report.hasSoughtMedicalConsultation,
      hasRequestedMedicalConsultation: report.hasRequestedMedicalConsultation,
      consultationStatus: report.consultationStatus,
      consultationNotObtainedReason: report.consultationNotObtainedReason,
      healthCenterId: report.healthCenterId,
      specialty: report.specialty,
      diagnosisSearchDuration: DurationResponseDto.from(
        report.diagnosisSearchDuration,
      ),
      hasReceivedDiagnosis: report.hasReceivedDiagnosis,
      reportedDiagnosis: report.reportedDiagnosis,
      isReceivingReportedTreatment: report.isReceivingReportedTreatment,
      reportedTreatment: report.reportedTreatment,
      reportedTreatmentFrequency: DurationResponseDto.from(
        report.reportedTreatmentFrequency,
      ),
      notReceivingTreatmentReason: report.notReceivingTreatmentReason,
      createdAt: report.createdAt.toISOString(),
    };
  }
}
