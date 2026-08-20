import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CareProgram } from '../../../../../database/entities/care-program.enum';
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

  @ApiProperty()
  isReferred!: boolean;

  @ApiProperty({ format: 'uuid', nullable: true })
  sourceHealthCenterId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceHealthCenterName?: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  receivingHealthCenterId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  receivingHealthCenterName?: string | null;

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

  @ApiProperty({ nullable: true })
  operationName!: string | null;

  @ApiProperty({ enum: CareProgram, nullable: true })
  careProgram!: CareProgram | null;

  @ApiProperty({ nullable: true })
  receivesTeleconsultation!: boolean | null;

  @ApiProperty({ nullable: true })
  teleconsultationNote!: string | null;

  @ApiProperty({ type: [String], nullable: true })
  teleconsultationSpecialties!: string[] | null;

  @ApiProperty({ enum: TreatmentSituation, nullable: true })
  treatmentSituation!: TreatmentSituation | null;

  @ApiProperty({ nullable: true })
  treatmentAbandonmentReason!: string | null;

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
      isReferred: treatment.isReferred,
      sourceHealthCenterId: treatment.sourceHealthCenterId,
      sourceHealthCenterName: treatment.sourceHealthCenter?.name ?? null,
      receivingHealthCenterId: treatment.receivingHealthCenterId,
      receivingHealthCenterName: treatment.receivingHealthCenter?.name ?? null,
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
      operationName: treatment.operationName,
      careProgram: treatment.careProgram,
      receivesTeleconsultation: treatment.receivesTeleconsultation,
      teleconsultationNote: treatment.teleconsultationNote,
      teleconsultationSpecialties: treatment.teleconsultationSpecialties,
      treatmentSituation: treatment.treatmentSituation,
      treatmentAbandonmentReason: treatment.treatmentAbandonmentReason,
      hasLatestPrescription: treatment.hasLatestPrescription,
      latestPrescriptionDate: treatment.latestPrescriptionDate,
      createdAt: treatment.createdAt.toISOString(),
    };
  }
}
