import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { DeactivationReason } from './deactivation-reason.enum';
import { FollowUp } from './follow-up.entity';
import { PatientActivityStatus } from './patient-activity-status.enum';
import { Patient } from './patient.entity';
import { User } from './user.entity';

/**
 * Every deactivation and reactivation of a patient. patients.activity_status
 * only caches the latest event; indicators read this table so a past period
 * shows who was inactive back then.
 */
@Entity('patient_activity_events')
@Index('IDX_patient_activity_events_patient_occurred', [
  'patientId',
  'occurredAt',
])
export class PatientActivityEvent {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ type: 'varchar', length: 20 }) status!: PatientActivityStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  reason!: DeactivationReason | null;

  @Column({ name: 'reason_detail', type: 'text', nullable: true })
  reasonDetail!: string | null;

  @Column({ name: 'deceased_at', type: 'date', nullable: true })
  deceasedAt!: string | null;

  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_user_id' })
  actor!: User | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
