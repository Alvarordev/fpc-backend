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
import { HealthCenter } from './health-center.entity';
import { FollowUp } from './follow-up.entity';
import { MedicalAppointmentStatus } from './medical-appointment-status.enum';
import { Patient } from './patient.entity';
import { Reminder } from './reminder.entity';

@Entity('patient_medical_appointments')
@Check(
  `"status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_ANSWER')`,
)
@Index('UQ_patient_medical_appointments_current', ['patientId', 'specialty'], {
  unique: true,
  where: '"is_current" = true',
})
@Index('IDX_patient_medical_appointments_patient_id', ['patientId'])
@Index('IDX_patient_medical_appointments_follow_up_id', ['followUpId'])
@Index('IDX_patient_medical_appointments_health_center_id', ['healthCenterId'])
@Index('IDX_patient_medical_appointments_reminder_id', ['reminderId'])
export class PatientMedicalAppointment {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'health_center_id', type: 'uuid', nullable: true })
  healthCenterId!: string | null;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'health_center_id' })
  healthCenter!: HealthCenter | null;
  @Column({ type: 'varchar', length: 255 }) specialty!: string;
  @Column({ name: 'appointment_date', type: 'date', nullable: true })
  appointmentDate!: string | null;
  @Column({ name: 'appointment_time', type: 'time', nullable: true })
  appointmentTime!: string | null;
  @Column({ name: 'next_appointment_date', type: 'date', nullable: true })
  nextAppointmentDate!: string | null;
  @Column({
    name: 'next_appointment_specialty',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nextAppointmentSpecialty!: string | null;
  @Column({ name: 'has_referral_sheet', type: 'boolean', nullable: true })
  hasReferralSheet!: boolean | null;
  @Column({ name: 'referred_to', type: 'varchar', length: 255, nullable: true })
  referredTo!: string | null;
  @Column({
    name: 'referral_not_provided_reason',
    type: 'text',
    nullable: true,
  })
  referralNotProvidedReason!: string | null;
  @Column({ type: 'text', nullable: true }) difficulties!: string | null;
  @Column({ name: 'is_first_consultation', type: 'boolean', default: false })
  isFirstConsultation!: boolean;
  @Column({
    type: 'varchar',
    length: 20,
    default: MedicalAppointmentStatus.SCHEDULED,
  })
  status!: MedicalAppointmentStatus;
  @Column({ name: 'reminder_id', type: 'uuid', nullable: true })
  reminderId!: string | null;
  @ManyToOne(() => Reminder, { nullable: true })
  @JoinColumn({ name: 'reminder_id' })
  reminder!: Reminder | null;
  @Column({ name: 'attended_via_sepa', type: 'boolean', nullable: true })
  attendedViaSepa!: boolean | null;
  @Column({ name: 'referred_via_sepa', type: 'boolean', nullable: true })
  referredViaSepa!: boolean | null;
  @Column({ name: 'is_current', type: 'boolean' }) isCurrent!: boolean;
  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
