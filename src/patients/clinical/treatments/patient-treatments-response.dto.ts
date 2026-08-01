import { ApiProperty } from '@nestjs/swagger';
import { PatientTreatment } from '../../entities/patient-treatment.entity';

export class PatientTreatmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty({ format: 'uuid' })
  diagnosisId!: string;

  @ApiProperty()
  treatmentType!: string;

  @ApiProperty({ nullable: true })
  treatmentFrequency!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  healthCenterId!: string | null;

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
  treatmentSituation!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(treatment: PatientTreatment): PatientTreatmentResponseDto {
    return {
      id: treatment.id,
      patientId: treatment.patientId,
      followUpId: treatment.followUpId,
      diagnosisId: treatment.diagnosisId,
      treatmentType: treatment.treatmentType,
      treatmentFrequency: treatment.treatmentFrequency,
      healthCenterId: treatment.healthCenterId,
      startDate: treatment.startDate,
      endDate: treatment.endDate,
      isCurrent: treatment.isCurrent,
      changeReason: treatment.changeReason,
      notReceivingReason: treatment.notReceivingReason,
      treatmentSituation: treatment.treatmentSituation,
      createdAt: treatment.createdAt.toISOString(),
    };
  }
}
