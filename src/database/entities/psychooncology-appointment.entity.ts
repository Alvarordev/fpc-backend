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
import { FollowUp } from './follow-up.entity';
import { Companion } from './companion.entity';
import { Patient } from './patient.entity';
import { VolunteerAvailability } from './volunteer-availability.entity';
import { Volunteer } from './volunteer.entity';
import { User } from './user.entity';
import { PsychooncologyCycle } from './psychooncology-cycle.entity';
export enum AppointmentModality {
  CALL = 'CALL',
  VIDEO_CALL = 'VIDEO_CALL',
}

export enum AppointmentBeneficiaryType {
  PATIENT = 'PATIENT',
  COMPANION = 'COMPANION',
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
  OVERDUE = 'OVERDUE',
}

export enum AppointmentReminderMode {
  TWO_HOURS = 'TWO_HOURS',
  ONE_DAY = 'ONE_DAY',
  CUSTOM = 'CUSTOM',
  MANUAL = 'MANUAL',
}

/** Sessions still waiting to happen: the slot stays reserved. */
export const PENDING_APPOINTMENT_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.OVERDUE,
];
@Entity('psychooncology_appointments')
@Check('"session_number" > 0')
@Check(`"modality" IN ('CALL','VIDEO_CALL')`)
@Check(
  `"status" IN ('SCHEDULED','COMPLETED','NO_SHOW','CANCELLED','RESCHEDULED','OVERDUE')`,
)
@Check(`"reminder_mode" IN ('TWO_HOURS','ONE_DAY','CUSTOM','MANUAL')`)
@Check(
  `"beneficiary_type" IN ('PATIENT','COMPANION') AND (("beneficiary_type" = 'PATIENT' AND "companion_id" IS NULL) OR ("beneficiary_type" = 'COMPANION' AND "companion_id" IS NOT NULL))`,
)
@Index('IDX_psychooncology_appointments_patient_id', ['patientId'])
@Index('IDX_psychooncology_appointments_volunteer_id', ['volunteerId'])
@Index('IDX_psychooncology_appointments_follow_up_id', ['followUpId'])
@Index('IDX_psychooncology_appointments_availability_id', ['availabilityId'])
@Index('IDX_psychooncology_appointments_companion_id', ['companionId'])
@Index('IDX_psychooncology_appointments_status', ['status'])
@Index('IDX_psychooncology_appointments_volunteer_patient', [
  'volunteerId',
  'patientId',
])
@Index('IDX_psychooncology_appointments_patient_scheduled_timeline', [
  'patientId',
  'scheduledOn',
  'createdAt',
  'id',
])
@Index('IDX_psychooncology_appointments_cycle_id', ['cycleId'])
@Index('IDX_psychooncology_appointments_historical_loaded_by_id', [
  'historicalLoadedById',
])
export class PsychooncologyAppointment {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({
    name: 'beneficiary_type',
    type: 'varchar',
    length: 20,
    default: AppointmentBeneficiaryType.PATIENT,
  })
  beneficiaryType!: AppointmentBeneficiaryType;
  @Column({ name: 'companion_id', type: 'uuid', nullable: true })
  companionId!: string | null;
  @ManyToOne(() => Companion)
  @JoinColumn({ name: 'companion_id' })
  companion!: Companion | null;
  @Column({ name: 'volunteer_id', type: 'uuid' }) volunteerId!: string;
  @ManyToOne(() => Volunteer)
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer;
  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp | null;
  @Column({ name: 'availability_id', type: 'uuid' }) availabilityId!: string;
  @ManyToOne(() => VolunteerAvailability)
  @JoinColumn({ name: 'availability_id' })
  availability!: VolunteerAvailability;
  @Column({
    name: 'patient_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  patientEmail!: string | null;
  @Column({ name: 'zoom_link', type: 'text', nullable: true })
  zoomLink!: string | null;
  @Column({ name: 'session_number', type: 'int' }) sessionNumber!: number;
  @Column({ name: 'is_additional_session', type: 'boolean', default: false })
  isAdditionalSession!: boolean;
  @Column({ type: 'varchar', length: 20 }) modality!: AppointmentModality;
  @Column({ type: 'varchar', length: 20, default: AppointmentStatus.SCHEDULED })
  status!: AppointmentStatus;
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;
  @Column({ name: 'scheduled_on', type: 'date', nullable: true })
  scheduledOn!: string | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
  @Column({ name: 'completed_on', type: 'date', nullable: true })
  completedOn!: string | null;
  @Column({ name: 'topic_addressed', type: 'text', nullable: true })
  topicAddressed!: string | null;
  @Column({ name: 'session_details', type: 'text', nullable: true })
  sessionDetails!: string | null;
  @Column({ name: 'additional_observations', type: 'text', nullable: true })
  additionalObservations!: string | null;
  @Column({ type: 'text', nullable: true }) recommendations!: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) referral!:
    string | null;
  @Column({ name: 'scheduling_notes', type: 'text', nullable: true })
  schedulingNotes!: string | null;
  @Column({ name: 'no_answer_note', type: 'text', nullable: true })
  noAnswerNote!: string | null;
  @Column({ name: 'satisfaction_rating', type: 'int', nullable: true })
  satisfactionRating!: number | null;
  @Column({ name: 'satisfaction_comment', type: 'text', nullable: true })
  satisfactionComment!: string | null;
  @Column({ name: 'cycle_id', type: 'uuid', nullable: true })
  cycleId!: string | null;
  @ManyToOne(() => PsychooncologyCycle, { nullable: true })
  @JoinColumn({ name: 'cycle_id' })
  cycle!: PsychooncologyCycle | null;
  @Column({ name: 'rescheduled_to_id', type: 'uuid', nullable: true })
  rescheduledToId!: string | null;
  @ManyToOne(() => PsychooncologyAppointment, { nullable: true })
  @JoinColumn({ name: 'rescheduled_to_id' })
  rescheduledTo!: PsychooncologyAppointment | null;
  @Column({ name: 'needs_reassignment', type: 'boolean', default: false })
  needsReassignment!: boolean;
  @Column({
    name: 'reminder_mode',
    type: 'varchar',
    length: 20,
    default: AppointmentReminderMode.MANUAL,
  })
  reminderMode!: AppointmentReminderMode;
  @Column({ name: 'remind_at', type: 'timestamptz', nullable: true })
  remindAt!: Date | null;
  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt!: Date | null;
  @Column({ name: 'no_show_managed_at', type: 'timestamptz', nullable: true })
  noShowManagedAt!: Date | null;
  @Column({ name: 'no_show_managed_by_id', type: 'uuid', nullable: true })
  noShowManagedById!: string | null;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'no_show_managed_by_id' })
  noShowManagedBy!: User | null;
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
