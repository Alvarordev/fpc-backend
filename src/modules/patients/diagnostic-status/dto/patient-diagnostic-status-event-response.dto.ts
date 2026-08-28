import { ApiProperty } from '@nestjs/swagger';
import { PatientDiagnosticStatusEvent } from '../../../../database/entities/patient-diagnostic-status-event.entity';
import { PatientDiagnosticStatus } from '../../../../database/entities/patient-diagnostic-status.enum';

export class PatientDiagnosticStatusEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  followUpId!: string | null;

  @ApiProperty({ enum: PatientDiagnosticStatus })
  status!: PatientDiagnosticStatus;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ nullable: true })
  reportedDiagnosis!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  diagnosisId!: string | null;

  @ApiProperty({ nullable: true })
  supportedBySepa!: boolean | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(
    event: PatientDiagnosticStatusEvent,
  ): PatientDiagnosticStatusEventResponseDto {
    return {
      id: event.id,
      patientId: event.patientId,
      followUpId: event.followUpId,
      status: event.status,
      occurredAt: event.occurredAt.toISOString(),
      reportedDiagnosis: event.reportedDiagnosis,
      diagnosisId: event.diagnosisId,
      supportedBySepa: event.supportedBySepa,
      notes: event.notes,
      createdAt: event.createdAt.toISOString(),
    };
  }
}
