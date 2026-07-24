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
import { Agent } from './agent.entity';
import { Interaction } from './interaction.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { ReminderStatus } from './reminder-status.enum';
@Entity('reminders')
@Check(`"status" IN ('PENDING','DONE','DISMISSED')`)
@Index('IDX_reminders_subject_patient_id', ['subjectPatientId'])
@Index('IDX_reminders_created_from_interaction_id', [
  'createdFromInteractionId',
])
@Index('IDX_reminders_assigned_agent_id', ['assignedAgentId'])
@Index('IDX_reminders_resulting_interaction_id', ['resultingInteractionId'])
@Index('IDX_reminders_status', ['status'])
@Index('IDX_reminders_due_at', ['dueAt'])
export class Reminder {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'subject_patient_id', type: 'uuid' })
  subjectPatientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'subject_patient_id' })
  subjectPatient!: Patient;
  @Column({ name: 'created_from_interaction_id', type: 'uuid', nullable: true })
  createdFromInteractionId!: string | null;
  @ManyToOne(() => Interaction)
  @JoinColumn({ name: 'created_from_interaction_id' })
  createdFromInteraction!: Interaction | null;
  @Column({ name: 'assigned_agent_id', type: 'uuid', nullable: true })
  assignedAgentId!: string | null;
  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'assigned_agent_id' })
  assignedAgent!: Agent | null;
  @Column({ name: 'due_at', type: 'timestamptz' }) dueAt!: Date;
  @Column({ type: 'text' }) description!: string;
  @Column({ type: 'varchar', length: 20, default: ReminderStatus.PENDING })
  status!: ReminderStatus;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
  @Column({ name: 'resulting_interaction_id', type: 'uuid', nullable: true })
  resultingInteractionId!: string | null;
  @ManyToOne(() => Interaction)
  @JoinColumn({ name: 'resulting_interaction_id' })
  resultingInteraction!: Interaction | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
