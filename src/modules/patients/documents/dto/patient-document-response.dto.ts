import { ApiProperty } from '@nestjs/swagger';
import {
  PatientDocument,
  PatientDocumentStatus,
  PatientDocumentType,
} from '../../../../database/entities/patient-document.entity';

export class PatientDocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ enum: PatientDocumentType })
  documentType!: PatientDocumentType;

  @ApiProperty({ format: 'uuid', nullable: true })
  diagnosisId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  treatmentId!: string | null;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  originalFileName!: string;

  @ApiProperty()
  mediaType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty()
  sha256!: string;

  @ApiProperty({ enum: PatientDocumentStatus })
  status!: PatientDocumentStatus;

  @ApiProperty({ format: 'uuid' })
  uploadedById!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  archivedAt!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  archivedById!: string | null;

  static from(document: PatientDocument): PatientDocumentResponseDto {
    return {
      id: document.id,
      patientId: document.patientId,
      documentType: document.documentType,
      diagnosisId: document.diagnosisId,
      treatmentId: document.treatmentId,
      description: document.description,
      originalFileName: document.originalFileName,
      mediaType: document.mediaType,
      sizeBytes: document.sizeBytes,
      sha256: document.sha256,
      status: document.status,
      uploadedById: document.uploadedById,
      createdAt: document.createdAt.toISOString(),
      archivedAt: document.archivedAt?.toISOString() ?? null,
      archivedById: document.archivedById,
    };
  }
}

export class PatientDocumentListResponseDto {
  @ApiProperty({ type: [PatientDocumentResponseDto] })
  data!: PatientDocumentResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}
