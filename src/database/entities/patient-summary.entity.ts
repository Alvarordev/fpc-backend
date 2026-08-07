import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.entity';

export enum PatientSummaryStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

@Entity('patient_summaries')
@Check(`"status" IN ('PENDING','PROCESSING','READY','FAILED')`)
@Index('IDX_patient_summaries_status_available_at', ['status', 'availableAt'])
export class PatientSummary {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'patient_id', type: 'uuid', unique: true })
  patientId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({
    type: 'varchar',
    length: 20,
    default: PatientSummaryStatus.PENDING,
  })
  status!: PatientSummaryStatus;

  @Column({ type: 'text', nullable: true }) summary!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true }) model!:
    string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode!: string | null;

  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  errorMessage!: string | null;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ name: 'available_at', type: 'timestamptz', default: () => 'now()' })
  availableAt!: Date;

  @Column({
    name: 'processing_started_at',
    type: 'timestamptz',
    nullable: true,
  })
  processingStartedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
