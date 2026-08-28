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
import { Enrollment } from './enrollment.entity';
import { HealthCenter } from './health-center.entity';
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';
import { Duration } from './embedded/duration.embedded';
import { MedicalConsultationStatus } from './medical-consultation-status.enum';

@Entity('patient_symptom_reports')
@Check('"pain_intensity" IS NULL OR "pain_intensity" BETWEEN 0 AND 10')
@Index('IDX_patient_symptom_reports_patient_id', ['patientId'])
@Index('IDX_patient_symptom_reports_follow_up_id', ['followUpId'])
@Index('IDX_patient_symptom_reports_enrollment_id', ['enrollmentId'])
@Index('IDX_patient_symptom_reports_health_center_id', ['healthCenterId'])
export class PatientSymptomReport {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'enrollment_id', type: 'uuid', nullable: true })
  enrollmentId!: string | null;
  @ManyToOne(() => Enrollment)
  @JoinColumn({ name: 'enrollment_id' })
  enrollment!: Enrollment | null;
  @Column({
    name: 'discomfort_severity',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  discomfortSeverity!: string | null;
  @Column({ name: 'discomfort_description', type: 'text', nullable: true })
  discomfortDescription!: string | null;
  @Column({ name: 'has_discomfort', type: 'boolean', nullable: true })
  hasDiscomfort!: boolean | null;
  @Column({ name: 'checkup_motivation', type: 'text', nullable: true })
  checkupMotivation!: string | null;
  @Column({ name: 'signs_and_symptoms', type: 'text', nullable: true })
  signsAndSymptoms!: string | null;
  @Column({ name: 'indications_received', type: 'text', nullable: true })
  indicationsReceived!: string | null;
  @Column(() => Duration, { prefix: 'symptom_duration' })
  symptomDuration!: Duration;
  @Column(() => Duration, { prefix: 'symptom_frequency' })
  symptomFrequency!: Duration;
  @Column({ name: 'is_pain_present', type: 'boolean', nullable: true })
  isPainPresent!: boolean | null;
  @Column({ name: 'pain_intensity', type: 'smallint', nullable: true })
  painIntensity!: number | null;
  @Column({
    name: 'pain_location',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  painLocation!: string | null;
  @Column({ name: 'pain_description', type: 'text', nullable: true })
  painDescription!: string | null;
  @Column({
    name: 'has_sought_medical_consultation',
    type: 'boolean',
    default: false,
  })
  hasSoughtMedicalConsultation!: boolean;
  @Column({
    name: 'has_requested_medical_consultation',
    type: 'boolean',
    nullable: true,
  })
  hasRequestedMedicalConsultation!: boolean | null;
  @Column({
    name: 'consultation_status',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  consultationStatus!: MedicalConsultationStatus | null;
  @Column({
    name: 'consultation_not_obtained_reason',
    type: 'text',
    nullable: true,
  })
  consultationNotObtainedReason!: string | null;
  @Column({ name: 'health_center_id', type: 'uuid', nullable: true })
  healthCenterId!: string | null;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'health_center_id' })
  healthCenter!: HealthCenter | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) specialty!:
    string | null;
  @Column(() => Duration, { prefix: 'diagnosis_search_duration' })
  diagnosisSearchDuration!: Duration;
  @Column({ name: 'has_received_diagnosis', type: 'boolean', nullable: true })
  hasReceivedDiagnosis!: boolean | null;
  @Column({ name: 'reported_diagnosis', type: 'text', nullable: true })
  reportedDiagnosis!: string | null;
  @Column({
    name: 'is_receiving_reported_treatment',
    type: 'boolean',
    nullable: true,
  })
  isReceivingReportedTreatment!: boolean | null;
  @Column({ name: 'reported_treatment', type: 'text', nullable: true })
  reportedTreatment!: string | null;
  @Column(() => Duration, { prefix: 'reported_treatment_frequency' })
  reportedTreatmentFrequency!: Duration;
  @Column({
    name: 'not_receiving_treatment_reason',
    type: 'text',
    nullable: true,
  })
  notReceivingTreatmentReason!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
