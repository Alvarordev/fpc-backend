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
import { FollowUp } from './follow-up.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { ReminderStatus } from './reminder-status.enum';
@Entity('reminders')
@Check(`"status" IN ('PENDING','DONE','DISMISSED')`)
@Index('IDX_reminders_subject_patient_id', ['subjectPatientId'])
@Index('IDX_reminders_created_from_follow_up_id', ['createdFromFollowUpId'])
@Index('IDX_reminders_assigned_agent_id', ['assignedAgentId'])
@Index('IDX_reminders_resulting_follow_up_id', ['resultingFollowUpId'])
@Index('IDX_reminders_status', ['status'])
@Index('IDX_reminders_due_at', ['dueAt'])
export class Reminder {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'subject_patient_id', type: 'uuid' })
  subjectPatientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'subject_patient_id' })
  subjectPatient!: Patient;
  @Column({ name: 'created_from_follow_up_id', type: 'uuid', nullable: true })
  createdFromFollowUpId!: string | null;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'created_from_follow_up_id' })
  createdFromFollowUp!: FollowUp | null;
  @Column({ name: 'assigned_agent_id', type: 'uuid' }) assignedAgentId!: string;
  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'assigned_agent_id' })
  assignedAgent!: Agent;
  @Column({ name: 'due_at', type: 'timestamptz' }) dueAt!: Date;
  @Column({ type: 'text' }) description!: string;
  @Column({ type: 'varchar', length: 20, default: ReminderStatus.PENDING })
  status!: ReminderStatus;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
  @Column({ name: 'resulting_follow_up_id', type: 'uuid', nullable: true })
  resultingFollowUpId!: string | null;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'resulting_follow_up_id' })
  resultingFollowUp!: FollowUp | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
