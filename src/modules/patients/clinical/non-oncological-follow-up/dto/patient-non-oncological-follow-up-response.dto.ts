import { ApiProperty } from '@nestjs/swagger';
import { PatientNonOncologicalFollowUp } from '../../../../../database/entities/patient-non-oncological-follow-up.entity';
import { PatientNonOncologicalFollowUpStatus } from '../../../../../database/entities/patient-non-oncological-follow-up-status.enum';
import { DurationResponseDto } from '../../../../../shared/duration/duration-response.dto';

export class PatientNonOncologicalFollowUpResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) followUpId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) enrollmentId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  diagnosticStatusEventId!: string | null;
  @ApiProperty() diagnosis!: string;
  @ApiProperty({ format: 'date' }) occurredOn!: string;
  @ApiProperty({ nullable: true }) receivesTreatment!: boolean | null;
  @ApiProperty({ nullable: true }) treatmentName!: string | null;
  @ApiProperty({ nullable: true }) medication!: string | null;
  @ApiProperty({ type: DurationResponseDto, nullable: true })
  treatmentFrequency!: DurationResponseDto | null;
  @ApiProperty({ nullable: true }) hasControls!: boolean | null;
  @ApiProperty({ nullable: true }) controlSpecialty!: string | null;
  @ApiProperty({ type: DurationResponseDto, nullable: true })
  controlPeriodicity!: DurationResponseDto | null;
  @ApiProperty({ enum: PatientNonOncologicalFollowUpStatus })
  status!: PatientNonOncologicalFollowUpStatus;
  @ApiProperty({ format: 'date', nullable: true }) dischargedOn!: string | null;
  @ApiProperty({ nullable: true }) dischargeReason!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;

  static from(
    record: PatientNonOncologicalFollowUp,
  ): PatientNonOncologicalFollowUpResponseDto {
    return {
      id: record.id,
      patientId: record.patientId,
      followUpId: record.followUpId,
      enrollmentId: record.enrollmentId,
      diagnosticStatusEventId: record.diagnosticStatusEventId,
      diagnosis: record.diagnosis,
      occurredOn: record.occurredOn,
      receivesTreatment: record.receivesTreatment,
      treatmentName: record.treatmentName,
      medication: record.medication,
      treatmentFrequency: DurationResponseDto.from(record.treatmentFrequency),
      hasControls: record.hasControls,
      controlSpecialty: record.controlSpecialty,
      controlPeriodicity: DurationResponseDto.from(record.controlPeriodicity),
      status: record.status,
      dischargedOn: record.dischargedOn,
      dischargeReason: record.dischargeReason,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
