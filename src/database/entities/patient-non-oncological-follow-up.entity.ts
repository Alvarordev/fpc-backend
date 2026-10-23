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
import { Enrollment } from './enrollment.entity';
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';
import { Duration } from './embedded/duration.embedded';
import { PatientNonOncologicalFollowUpStatus } from './patient-non-oncological-follow-up-status.enum';

@Entity('patient_non_oncological_follow_ups')
@Check(
  'CHK_patient_non_oncological_follow_ups_status',
  `"status" IN ('ACTIVE', 'DISCHARGED')`,
)
@Index('IDX_patient_non_oncological_follow_ups_patient_occurred', [
  'patientId',
  'occurredOn',
  'id',
])
@Index('IDX_patient_non_oncological_follow_ups_patient_status', [
  'patientId',
  'status',
])
@Index('IDX_patient_non_oncological_follow_ups_follow_up_id', ['followUpId'])
@Index('IDX_patient_non_oncological_follow_ups_enrollment_id', ['enrollmentId'])
export class PatientNonOncologicalFollowUp {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;

  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp | null;

  @Column({ name: 'enrollment_id', type: 'uuid', nullable: true })
  enrollmentId!: string | null;

  @ManyToOne(() => Enrollment)
  @JoinColumn({ name: 'enrollment_id' })
  enrollment!: Enrollment | null;

  @Column({ name: 'diagnostic_status_event_id', type: 'uuid', nullable: true })
  diagnosticStatusEventId!: string | null;

  @Column({ name: 'diagnosis', type: 'text' })
  diagnosis!: string;

  @Column({ name: 'occurred_on', type: 'date' })
  occurredOn!: string;

  @Column({ name: 'receives_treatment', type: 'boolean', nullable: true })
  receivesTreatment!: boolean | null;

  @Column({ name: 'treatment_name', type: 'text', nullable: true })
  treatmentName!: string | null;

  @Column({ name: 'medication', type: 'text', nullable: true })
  medication!: string | null;

  @Column(() => Duration, { prefix: 'treatment_frequency' })
  treatmentFrequency!: Duration;

  @Column({ name: 'has_controls', type: 'boolean', nullable: true })
  hasControls!: boolean | null;

  @Column({
    name: 'control_specialty',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  controlSpecialty!: string | null;

  @Column(() => Duration, { prefix: 'control_periodicity' })
  controlPeriodicity!: Duration;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: PatientNonOncologicalFollowUpStatus.ACTIVE,
  })
  status!: PatientNonOncologicalFollowUpStatus;

  @Column({ name: 'discharged_on', type: 'date', nullable: true })
  dischargedOn!: string | null;

  @Column({ name: 'discharge_reason', type: 'text', nullable: true })
  dischargeReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
