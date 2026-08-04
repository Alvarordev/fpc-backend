import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CancerStage,
  PatientDiagnosis,
} from '../../entities/patient-diagnosis.entity';

export class PatientDiagnosisResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty()
  diagnosis!: string;

  @ApiProperty({ enum: CancerStage, nullable: true })
  cancerStage!: CancerStage | null;

  @ApiProperty({ format: 'date', nullable: true })
  diagnosisDate!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  healthCenterId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  healthCenterName?: string | null;

  @ApiProperty({ nullable: true })
  diagnosisSpecialty!: string | null;

  @ApiProperty({ nullable: true })
  symptomLeadingToCheckup!: string | null;

  @ApiProperty({ nullable: true })
  waitTimeForDiagnosis!: string | null;

  @ApiProperty()
  hasMedicalReport!: boolean;

  @ApiProperty()
  isCurrent!: boolean;

  @ApiProperty({ nullable: true })
  changeReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(diagnosis: PatientDiagnosis): PatientDiagnosisResponseDto {
    return {
      id: diagnosis.id,
      patientId: diagnosis.patientId,
      followUpId: diagnosis.followUpId,
      diagnosis: diagnosis.diagnosis,
      cancerStage: diagnosis.cancerStage,
      diagnosisDate: diagnosis.diagnosisDate,
      healthCenterId: diagnosis.healthCenterId,
      healthCenterName: diagnosis.healthCenter?.name ?? null,
      diagnosisSpecialty: diagnosis.diagnosisSpecialty,
      symptomLeadingToCheckup: diagnosis.symptomLeadingToCheckup,
      waitTimeForDiagnosis: diagnosis.waitTimeForDiagnosis,
      hasMedicalReport: diagnosis.hasMedicalReport,
      isCurrent: diagnosis.isCurrent,
      changeReason: diagnosis.changeReason,
      createdAt: diagnosis.createdAt.toISOString(),
    };
  }
}
