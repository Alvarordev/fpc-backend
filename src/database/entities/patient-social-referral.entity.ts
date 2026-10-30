import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FollowUp } from './follow-up.entity';
import { HealthCenter } from './health-center.entity';
import { Patient } from './patient.entity';
import { PatientSocialReferralUpdate } from './patient-social-referral-update.entity';
import { User } from './user.entity';

export enum SocialReferralType {
  COMPLAINT = 'COMPLAINT',
  SOCIAL_WORKER = 'SOCIAL_WORKER',
  FISSAL = 'FISSAL',
  CONADIS = 'CONADIS',
}

export enum SocialReferralStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

/**
 * A referral SEPA made for a patient (complaint office, social worker, FISSAL,
 * CONADIS). Its effectiveness is tracked through the updates recorded on
 * later follow-ups; the latest update decides whether the case is closed.
 */
@Entity('patient_social_referrals')
@Check(`"type" IN ('COMPLAINT','SOCIAL_WORKER','FISSAL','CONADIS')`)
@Check(`"status" IN ('OPEN','CLOSED')`)
@Check(
  `("type" = 'COMPLAINT') = ("complaint_channel" IS NOT NULL AND "health_center_id" IS NOT NULL)`,
)
@Index('IDX_patient_social_referrals_patient_opened_at', [
  'patientId',
  'openedAt',
])
@Index('IDX_patient_social_referrals_health_center_id', ['healthCenterId'])
export class PatientSocialReferral {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ type: 'varchar', length: 20 }) type!: SocialReferralType;

  /** catalog `complaint_channel`; only for complaints. */
  @Column({
    name: 'complaint_channel',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  complaintChannel!: string | null;

  @Column({ name: 'health_center_id', type: 'uuid', nullable: true })
  healthCenterId!: string | null;

  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'health_center_id' })
  healthCenter!: HealthCenter | null;

  /** What the complaint is about, e.g. "Tomógrafo malogrado". */
  @Column({ type: 'text', nullable: true }) issue!: string | null;

  @Column({ type: 'text', nullable: true }) note!: string | null;

  @Column({ type: 'varchar', length: 10, default: SocialReferralStatus.OPEN })
  status!: SocialReferralStatus;

  @Column({ name: 'opened_at', type: 'date' }) openedAt!: string;

  @Column({ name: 'closed_at', type: 'date', nullable: true })
  closedAt!: string | null;

  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;

  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;

  @Column({ name: 'created_by_id', type: 'uuid' }) createdById!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User;

  @OneToMany(() => PatientSocialReferralUpdate, (update) => update.referral)
  updates!: PatientSocialReferralUpdate[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
