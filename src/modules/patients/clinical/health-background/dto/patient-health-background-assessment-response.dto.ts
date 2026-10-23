import { ApiProperty } from '@nestjs/swagger';
import {
  LimitationCause,
  PatientHealthBackgroundAssessment,
} from '../../../../../database/entities/patient-health-background-assessment.entity';

export class PatientActiveComorbidityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  conditionName!: string;

  @ApiProperty({ nullable: true })
  treatmentDescription!: string | null;

  @ApiProperty({ nullable: true })
  followUpSpecialty!: string | null;
}

export class PatientLimitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: LimitationCause })
  cause!: LimitationCause;
}

export class PatientFamilyCancerHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  relationship!: string;

  @ApiProperty({ nullable: true })
  cancerType!: string | null;
}

export class PatientHealthBackgroundAssessmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty({ nullable: true })
  hasPsychiatry!: boolean | null;

  @ApiProperty({ type: PatientActiveComorbidityResponseDto, isArray: true })
  activeComorbidities!: PatientActiveComorbidityResponseDto[];

  @ApiProperty({ type: PatientLimitationResponseDto, isArray: true })
  limitations!: PatientLimitationResponseDto[];

  @ApiProperty({ type: PatientFamilyCancerHistoryResponseDto, isArray: true })
  familyCancerHistory!: PatientFamilyCancerHistoryResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(
    assessment: PatientHealthBackgroundAssessment,
  ): PatientHealthBackgroundAssessmentResponseDto {
    return {
      id: assessment.id,
      patientId: assessment.patientId,
      followUpId: assessment.followUpId,
      hasPsychiatry: assessment.hasPsychiatry,
      activeComorbidities: (assessment.activeComorbidities ?? []).map(
        (item) => ({
          id: item.id,
          conditionName: item.conditionName,
          treatmentDescription: item.treatmentDescription,
          followUpSpecialty: item.followUpSpecialty,
        }),
      ),
      limitations: (assessment.limitations ?? []).map((item) => ({
        id: item.id,
        description: item.description,
        cause: item.cause,
      })),
      familyCancerHistory: (assessment.familyCancerHistory ?? []).map(
        (item) => ({
          id: item.id,
          relationship: item.relationship,
          cancerType: item.cancerType,
        }),
      ),
      createdAt: assessment.createdAt.toISOString(),
    };
  }
}
