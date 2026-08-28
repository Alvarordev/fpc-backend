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
import { FollowUp } from './follow-up.entity';
import { PatientDiagnosis } from './patient-diagnosis.entity';
import { PatientDiagnosticStatus } from './patient-diagnostic-status.enum';
import { Patient } from './patient.entity';

@Entity('patient_diagnostic_status_events')
@Check(
  'CHK_patient_diagnostic_status_events_status',
  `"status" IN ('SEARCHING', 'CONFIRMED', 'RULED_OUT')`,
)
@Index('IDX_patient_diagnostic_status_events_patient_occurred', [
  'patientId',
  'occurredAt',
  'id',
])
@Index('IDX_patient_diagnostic_status_events_status_occurred', [
  'status',
  'occurredAt',
])
@Index('IDX_patient_diagnostic_status_events_follow_up_id', ['followUpId'])
@Index('IDX_patient_diagnostic_status_events_diagnosis_id', ['diagnosisId'])
export class PatientDiagnosticStatusEvent {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp | null;

  @Column({ type: 'varchar', length: 20 }) status!: PatientDiagnosticStatus;

  @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt!: Date;

  @Column({ name: 'reported_diagnosis', type: 'text', nullable: true })
  reportedDiagnosis!: string | null;

  @Column({ name: 'diagnosis_id', type: 'uuid', nullable: true })
  diagnosisId!: string | null;
  @ManyToOne(() => PatientDiagnosis)
  @JoinColumn({ name: 'diagnosis_id' })
  diagnosis!: PatientDiagnosis | null;

  @Column({ name: 'supported_by_sepa', type: 'boolean', nullable: true })
  supportedBySepa!: boolean | null;

  @Column({ type: 'text', nullable: true }) notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
