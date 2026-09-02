import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Agent } from './agent.entity';
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';
import { PatientMedicalAppointment } from './patient-medical-appointment.entity';
import { ReminderKind } from './reminder-kind.enum';
import { ReminderStatus } from './reminder-status.enum';
import { User } from './user.entity';

@Entity('reminders')
@Check(`"status" IN ('PENDING','DONE','DISMISSED')`)
@Check(`"kind" IN ('GENERIC','MEDICAL_APPOINTMENT')`)
@Index('IDX_reminders_subject_patient_id', ['subjectPatientId'])
@Index('IDX_reminders_created_from_follow_up_id', ['createdFromFollowUpId'])
@Index('IDX_reminders_assigned_agent_id', ['assignedAgentId'])
@Index('IDX_reminders_resulting_follow_up_id', ['resultingFollowUpId'])
@Index('IDX_reminders_medical_appointment_id', ['medicalAppointmentId'])
@Index('IDX_reminders_status', ['status'])
@Index('IDX_reminders_due_at', ['dueAt'])
@Index('IDX_reminders_due_on', ['subjectPatientId', 'dueOn', 'createdAt', 'id'])
@Index('IDX_reminders_patient_due_timeline', [
  'subjectPatientId',
  'dueAt',
  'id',
])
@Index('IDX_reminders_historical_loaded_by_id', ['historicalLoadedById'])
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
  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt!: Date | null;
  @Column({ name: 'due_on', type: 'date', nullable: true })
  dueOn!: string | null;
  @Column({ type: 'text' }) description!: string;
  @Column({
    type: 'varchar',
    length: 30,
    default: ReminderKind.GENERIC,
  })
  kind!: ReminderKind;
  @Column({ name: 'medical_appointment_id', type: 'uuid', nullable: true })
  medicalAppointmentId!: string | null;
  @ManyToOne(() => PatientMedicalAppointment, { nullable: true })
  @JoinColumn({ name: 'medical_appointment_id' })
  medicalAppointment!: PatientMedicalAppointment | null;
  @Column({ type: 'varchar', length: 20, default: ReminderStatus.PENDING })
  status!: ReminderStatus;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
  @Column({ name: 'completed_on', type: 'date', nullable: true })
  completedOn!: string | null;
  @Column({ name: 'resulting_follow_up_id', type: 'uuid', nullable: true })
  resultingFollowUpId!: string | null;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'resulting_follow_up_id' })
  resultingFollowUp!: FollowUp | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
  @Column({ name: 'is_historical', type: 'boolean', default: false })
  isHistorical!: boolean;
  @Column({ name: 'historical_loaded_by_id', type: 'uuid', nullable: true })
  historicalLoadedById!: string | null;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'historical_loaded_by_id' })
  historicalLoadedBy!: User | null;
}
