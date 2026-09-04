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
import { Patient } from './patient.entity';
import { Duration } from './embedded/duration.embedded';
import { WaitTimeSource } from './wait-time-source.enum';

export enum CancerStage {
  STAGE_1 = 'STAGE_1',
  STAGE_2 = 'STAGE_2',
  STAGE_3 = 'STAGE_3',
  STAGE_4 = 'STAGE_4',
  UNKNOWN = 'UNKNOWN',
}

@Entity('patient_diagnoses')
@Check(
  `"cancer_stage" IS NULL OR "cancer_stage" IN ('STAGE_1','STAGE_2','STAGE_3','STAGE_4','UNKNOWN')`,
)
@Check(
  `"wait_time_source" IS NULL OR "wait_time_source" IN ('COMPUTED','REPORTED')`,
)
@Index('IDX_patient_diagnoses_current', ['patientId'], {
  where: '"is_current" = true',
})
@Index('IDX_patient_diagnoses_patient_id', ['patientId'])
@Index('IDX_patient_diagnoses_follow_up_id', ['followUpId'])
@Index('IDX_patient_diagnoses_health_center_id', ['healthCenterId'])
@Index('IDX_patient_diagnoses_referred_health_center_id', [
  'referredHealthCenterId',
])
export class PatientDiagnosis {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ type: 'text' }) diagnosis!: string;
  @Column({ name: 'cancer_stage', type: 'varchar', length: 20, nullable: true })
  cancerStage!: CancerStage | null;
  @Column({ name: 'diagnosis_date', type: 'date', nullable: true })
  diagnosisDate!: string | null;
  @Column({ name: 'health_center_id', type: 'uuid', nullable: true })
  healthCenterId!: string | null;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'health_center_id' })
  healthCenter!: HealthCenter | null;
  @Column({ name: 'referred_health_center_id', type: 'uuid', nullable: true })
  referredHealthCenterId!: string | null;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'referred_health_center_id' })
  referredHealthCenter!: HealthCenter | null;
  @Column({ name: 'has_referral', type: 'boolean', nullable: true })
  hasReferral!: boolean | null;
  @Column({
    name: 'diagnosis_specialty',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  diagnosisSpecialty!: string | null;
  @Column({ name: 'symptom_leading_to_checkup', type: 'text', nullable: true })
  symptomLeadingToCheckup!: string | null;
  @Column({ name: 'first_symptoms_date', type: 'date', nullable: true })
  firstSymptomsDate!: string | null;
  @Column({
    name: 'wait_time_source',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  waitTimeSource!: WaitTimeSource | null;
  @Column(() => Duration, { prefix: 'wait_time_for_diagnosis' })
  waitTimeForDiagnosis!: Duration;
  @Column({ name: 'has_medical_report', type: 'boolean', default: false })
  hasMedicalReport!: boolean;
  @Column({ name: 'is_sepa_active_referral', type: 'boolean', nullable: true })
  isSepaActiveReferral!: boolean | null;
  @Column({ name: 'is_current', type: 'boolean' }) isCurrent!: boolean;
  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
