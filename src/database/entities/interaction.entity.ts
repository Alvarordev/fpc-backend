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
  InteractionPurpose,
  InteractionStatus,
  InteractionType,
} from './interaction.enums';
import { Patient } from '../../patients/entities/patient.entity';

@Entity('interactions')
@Check(
  `"type" IN ('WHATSAPP','CALL','VIDEO_CALL','EMAIL','IN_PERSON','FACEBOOK')`,
)
@Check(`"status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_ANSWER')`)
@Check(
  `"purpose" IN ('FIRST_CONTACT','ENROLLMENT','FOLLOW_UP','PSYCHOONCOLOGY_REFERRAL','OTHER')`,
)
@Index('IDX_interactions_subject_patient_id', ['subjectPatientId'])
@Index('IDX_interactions_interlocutor_id', ['interlocutorId'])
@Index('IDX_interactions_agent_id', ['agentId'])
@Index('IDX_interactions_next_interaction_id', ['nextInteractionId'])
@Index('IDX_interactions_status', ['status'])
export class Interaction {
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
  @Column({ type: 'varchar', length: 20 }) type!: InteractionType;
  @Column({ type: 'varchar', length: 20 }) status!: InteractionStatus;
  @Column({ type: 'varchar', length: 30 }) purpose!: InteractionPurpose;
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'next_interaction_id', type: 'uuid', nullable: true })
  nextInteractionId!: string | null;
  @ManyToOne(
    () => Interaction,
    (interaction) => interaction.previousInteractions,
  )
  @JoinColumn({ name: 'next_interaction_id' })
  nextInteraction!: Interaction | null;
  @OneToMany(() => Interaction, (interaction) => interaction.nextInteraction)
  previousInteractions!: Interaction[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
