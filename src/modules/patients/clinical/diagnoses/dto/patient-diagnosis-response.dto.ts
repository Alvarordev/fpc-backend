import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CancerStage,
  PatientDiagnosis,
} from '../../../../../database/entities/patient-diagnosis.entity';
import { WaitTimeSource } from '../../../../../database/entities/wait-time-source.enum';
import { DurationResponseDto } from '../../../../../shared/duration/duration-response.dto';

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

  @ApiProperty({ format: 'date', nullable: true })
  firstSymptomsDate!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  healthCenterId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  healthCenterName?: string | null;

  @ApiProperty({ nullable: true })
  diagnosisSpecialty!: string | null;

  @ApiProperty({ nullable: true })
  symptomLeadingToCheckup!: string | null;

  @ApiProperty({ enum: WaitTimeSource, nullable: true })
  waitTimeSource!: WaitTimeSource | null;

  @ApiProperty({ type: DurationResponseDto, nullable: true })
  waitTimeForDiagnosis!: DurationResponseDto | null;

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
      firstSymptomsDate: diagnosis.firstSymptomsDate,
      healthCenterId: diagnosis.healthCenterId,
      healthCenterName: diagnosis.healthCenter?.name ?? null,
      diagnosisSpecialty: diagnosis.diagnosisSpecialty,
      symptomLeadingToCheckup: diagnosis.symptomLeadingToCheckup,
      waitTimeSource: diagnosis.waitTimeSource,
      waitTimeForDiagnosis: DurationResponseDto.from(
        diagnosis.waitTimeForDiagnosis,
      ),
      hasMedicalReport: diagnosis.hasMedicalReport,
      isCurrent: diagnosis.isCurrent,
      changeReason: diagnosis.changeReason,
      createdAt: diagnosis.createdAt.toISOString(),
    };
  }
}
