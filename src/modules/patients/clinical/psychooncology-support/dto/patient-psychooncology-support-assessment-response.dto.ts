import { ApiProperty } from '@nestjs/swagger';
import { PatientPsychooncologySupportAssessment } from '../../../../../database/entities/patient-psychooncology-support-assessment.entity';
import { AppointmentModality } from '../../../../../database/entities/psychooncology-appointment.entity';

export class PatientPsychooncologySupportAssessmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty({ nullable: true })
  excessiveWorry!: boolean | null;

  @ApiProperty({ nullable: true, minimum: 1, maximum: 10 })
  emotionalDistressScore!: number | null;

  @ApiProperty({ enum: AppointmentModality, nullable: true })
  preferredModality!: AppointmentModality | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(
    assessment: PatientPsychooncologySupportAssessment,
  ): PatientPsychooncologySupportAssessmentResponseDto {
    return {
      id: assessment.id,
      patientId: assessment.patientId,
      followUpId: assessment.followUpId,
      excessiveWorry: assessment.excessiveWorry,
      emotionalDistressScore: assessment.emotionalDistressScore,
      preferredModality: assessment.preferredModality,
      createdAt: assessment.createdAt.toISOString(),
    };
  }
}
