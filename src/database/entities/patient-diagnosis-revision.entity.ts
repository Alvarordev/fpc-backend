import {
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
import { User } from './user.entity';

/**
 * Audit trail for in-place corrections of a diagnosis. The diagnosis row keeps
 * its id (treatments, documents and status events stay linked); each
 * correction stores the values it overwrote.
 */
@Entity('patient_diagnosis_revisions')
@Index('IDX_patient_diagnosis_revisions_diagnosis_id', ['diagnosisId'])
@Index('IDX_patient_diagnosis_revisions_follow_up_id', ['followUpId'])
export class PatientDiagnosisRevision {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'diagnosis_id', type: 'uuid' }) diagnosisId!: string;
  @ManyToOne(() => PatientDiagnosis)
  @JoinColumn({ name: 'diagnosis_id' })
  diagnosis!: PatientDiagnosis;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'changed_by_id', type: 'uuid', nullable: true })
  changedById!: string | null;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by_id' })
  changedBy!: User | null;
  @Column({ name: 'change_reason', type: 'text' }) changeReason!: string;
  @Column({ name: 'previous_values', type: 'jsonb' })
  previousValues!: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
