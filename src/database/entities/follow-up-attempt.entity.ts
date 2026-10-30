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
import { FollowUpAttemptOutcome, FollowUpType } from './follow-up.enums';
import { FollowUp } from './follow-up.entity';
import { User } from './user.entity';

/**
 * One contact attempt within a follow-up (S5). patient_id is a copy of the
 * follow-up's subject so the change_log trigger can resolve it directly.
 */
@Entity('follow_up_attempts')
@Check(
  `"channel" IN ('WHATSAPP','CALL','VIDEO_CALL','EMAIL','IN_PERSON','FACEBOOK')`,
)
@Check(`"outcome" IN ('CONTACTED','NO_ANSWER','WRONG_NUMBER','REJECTED')`)
@Index('IDX_follow_up_attempts_follow_up_id', ['followUpId', 'occurredAt'])
@Index('IDX_follow_up_attempts_patient_id', ['patientId'])
export class FollowUpAttempt {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp, (followUp) => followUp.attempts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @Column({ type: 'varchar', length: 20 }) channel!: FollowUpType;
  @Column({ type: 'varchar', length: 20 }) outcome!: FollowUpAttemptOutcome;
  @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt!: Date;
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser!: User | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
