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
import { Agent } from './agent.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from './follow-up.enums';
import { Patient } from '../../patients/entities/patient.entity';

@Entity('follow_ups')
@Check(
  `"type" IN ('WHATSAPP','CALL','VIDEO_CALL','EMAIL','IN_PERSON','FACEBOOK')`,
)
@Check(`"status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_ANSWER')`)
@Check(
  `"purpose" IN ('FIRST_CONTACT','ENROLLMENT','FOLLOW_UP','PSYCHOONCOLOGY_REFERRAL','OTHER')`,
)
@Index('IDX_follow_ups_subject_patient_id', ['subjectPatientId'])
@Index('IDX_follow_ups_interlocutor_id', ['interlocutorId'])
@Index('IDX_follow_ups_agent_id', ['agentId'])
@Index('IDX_follow_ups_next_follow_up_id', ['nextFollowUpId'])
@Index('IDX_follow_ups_status', ['status'])
export class FollowUp {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'subject_patient_id', type: 'uuid' })
  subjectPatientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'subject_patient_id' })
  subjectPatient!: Patient;
  @Column({ name: 'interlocutor_id', type: 'uuid' }) interlocutorId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'interlocutor_id' })
  interlocutor!: Patient;
  @Column({ name: 'agent_id', type: 'uuid' }) agentId!: string;
  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;
  @Column({ type: 'varchar', length: 20 }) type!: FollowUpType;
  @Column({ type: 'varchar', length: 20 }) status!: FollowUpStatus;
  @Column({ type: 'varchar', length: 30 }) purpose!: FollowUpPurpose;
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'next_follow_up_id', type: 'uuid', nullable: true })
  nextFollowUpId!: string | null;
  @ManyToOne(() => FollowUp, (followUp) => followUp.previousFollowUps)
  @JoinColumn({ name: 'next_follow_up_id' })
  nextFollowUp!: FollowUp | null;
  @OneToMany(() => FollowUp, (followUp) => followUp.nextFollowUp)
  previousFollowUps!: FollowUp[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
