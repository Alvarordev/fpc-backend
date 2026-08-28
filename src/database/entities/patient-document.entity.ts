import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PatientDiagnosis } from './patient-diagnosis.entity';
import { PatientTreatment } from './patient-treatment.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum PatientDocumentType {
  MEDICAL_REPORT = 'MEDICAL_REPORT',
  PRESCRIPTION = 'PRESCRIPTION',
  OTHER = 'OTHER',
}

export enum PatientDocumentStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

@Entity('patient_documents')
@Check("\"document_type\" IN ('MEDICAL_REPORT', 'PRESCRIPTION', 'OTHER')")
@Check("\"status\" IN ('PENDING', 'ACTIVE', 'ARCHIVED')")
@Check('"size_bytes" > 0 AND "size_bytes" <= 10485760')
@Check('length("sha256") = 64 AND "sha256" ~ \'^[0-9a-fA-F]{64}$\'')
@Check(
  '(("document_type" = \'MEDICAL_REPORT\' AND "diagnosis_id" IS NOT NULL AND "treatment_id" IS NULL) OR ("document_type" = \'PRESCRIPTION\' AND "diagnosis_id" IS NULL AND "treatment_id" IS NOT NULL) OR ("document_type" = \'OTHER\' AND "diagnosis_id" IS NULL AND "treatment_id" IS NULL AND "description" IS NOT NULL AND length(btrim("description")) > 0))',
)
@Check(
  '(("archived_at" IS NULL AND "archived_by_id" IS NULL) OR ("archived_at" IS NOT NULL AND "archived_by_id" IS NOT NULL))',
)
@Index('UQ_patient_documents_storage_key', ['storageKey'], { unique: true })
@Index(
  'IDX_patient_documents_patient_created_at_id',
  ['patientId', 'createdAt', 'id'],
  { where: '"status" <> \'PENDING\'' },
)
@Index('IDX_patient_documents_diagnosis_id', ['diagnosisId'])
@Index('IDX_patient_documents_treatment_id', ['treatmentId'])
@Index('IDX_patient_documents_document_type', ['documentType'])
@Index('IDX_patient_documents_uploaded_by_id', ['uploadedById'])
@Index('IDX_patient_documents_status_created_at', ['status', 'createdAt'])
export class PatientDocument {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => Patient, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'document_type', type: 'varchar', length: 32 })
  documentType!: PatientDocumentType;

  @Column({ name: 'diagnosis_id', type: 'uuid', nullable: true })
  diagnosisId!: string | null;

  @ManyToOne(() => PatientDiagnosis, { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'diagnosis_id' })
  diagnosis!: PatientDiagnosis | null;

  @Column({ name: 'treatment_id', type: 'uuid', nullable: true })
  treatmentId!: string | null;

  @ManyToOne(() => PatientTreatment, { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'treatment_id' })
  treatment!: PatientTreatment | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'original_file_name', type: 'varchar', length: 255 })
  originalFileName!: string;

  @Column({ name: 'media_type', type: 'varchar', length: 127 })
  mediaType!: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes!: number;

  @Column({ type: 'varchar', length: 64 })
  sha256!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: PatientDocumentStatus.PENDING,
  })
  status!: PatientDocumentStatus;

  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById!: string;

  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ name: 'archived_by_id', type: 'uuid', nullable: true })
  archivedById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'archived_by_id' })
  archivedBy!: User | null;
}
