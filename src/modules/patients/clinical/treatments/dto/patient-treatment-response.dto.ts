import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CancerStage } from '../../../../../database/entities/patient-diagnosis.entity';
import { PatientTreatment } from '../../../../../database/entities/patient-treatment.entity';
import { TreatmentSituation } from '../../../../../database/entities/treatment-situation.enum';
import { DurationResponseDto } from '../../../../../shared/duration/duration-response.dto';

export class PatientDiagnosisSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  diagnosis!: string;

  @ApiProperty({ enum: CancerStage, nullable: true })
  cancerStage!: CancerStage | null;

  @ApiProperty({ format: 'date', nullable: true })
  diagnosisDate!: string | null;
}

export class PatientTreatmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty({ format: 'uuid' })
  diagnosisId!: string;

  @ApiProperty({ format: 'uuid' })
  seriesId!: string;

  @ApiProperty()
  treatmentType!: string;

  @ApiProperty({ type: DurationResponseDto, nullable: true })
  treatmentFrequency!: DurationResponseDto | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  healthCenterId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  healthCenterName?: string | null;

  @ApiPropertyOptional({ type: PatientDiagnosisSummaryDto, nullable: true })
  diagnosisSummary?: PatientDiagnosisSummaryDto | null;

  @ApiProperty({ format: 'date', nullable: true })
  startDate!: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  endDate!: string | null;

  @ApiProperty()
  isCurrent!: boolean;

  @ApiProperty({ nullable: true })
  changeReason!: string | null;

  @ApiProperty({ nullable: true })
  notReceivingReason!: string | null;

  @ApiProperty({ enum: TreatmentSituation, nullable: true })
  treatmentSituation!: TreatmentSituation | null;

  @ApiProperty({ nullable: true })
  hasLatestPrescription!: boolean | null;

  @ApiProperty({ format: 'date', nullable: true })
  latestPrescriptionDate!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(treatment: PatientTreatment): PatientTreatmentResponseDto {
    return {
      id: treatment.id,
      patientId: treatment.patientId,
      followUpId: treatment.followUpId,
      diagnosisId: treatment.diagnosisId,
      seriesId: treatment.seriesId,
      treatmentType: treatment.treatmentType,
      treatmentFrequency: DurationResponseDto.from(
        treatment.treatmentFrequency,
      ),
      healthCenterId: treatment.healthCenterId,
      healthCenterName: treatment.healthCenter?.name ?? null,
      diagnosisSummary: treatment.diagnosis
        ? {
            id: treatment.diagnosis.id,
            diagnosis: treatment.diagnosis.diagnosis,
            cancerStage: treatment.diagnosis.cancerStage,
            diagnosisDate: treatment.diagnosis.diagnosisDate,
          }
        : null,
      startDate: treatment.startDate,
      endDate: treatment.endDate,
      isCurrent: treatment.isCurrent,
      changeReason: treatment.changeReason,
      notReceivingReason: treatment.notReceivingReason,
      treatmentSituation: treatment.treatmentSituation,
      hasLatestPrescription: treatment.hasLatestPrescription,
      latestPrescriptionDate: treatment.latestPrescriptionDate,
      createdAt: treatment.createdAt.toISOString(),
    };
  }
}
