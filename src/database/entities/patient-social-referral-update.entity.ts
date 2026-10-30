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
import { PatientSocialReferral } from './patient-social-referral.entity';
import { User } from './user.entity';

/** Append-only history of how a social referral is resolving. */
@Entity('patient_social_referral_updates')
@Index('IDX_patient_social_referral_updates_referral_created_at', [
  'referralId',
  'createdAt',
])
@Index('IDX_patient_social_referral_updates_follow_up_id', ['followUpId'])
export class PatientSocialReferralUpdate {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'referral_id', type: 'uuid' }) referralId!: string;

  @ManyToOne(() => PatientSocialReferral, (referral) => referral.updates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'referral_id' })
  referral!: PatientSocialReferral;

  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;

  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;

  /** Code from the outcome catalog of the referral type. */
  @Column({ type: 'varchar', length: 100 }) outcome!: string;

  @Column({ type: 'text', nullable: true }) note!: string | null;

  @Column({ name: 'author_id', type: 'uuid' }) authorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
