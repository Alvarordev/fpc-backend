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
import { Interaction } from './interaction.entity';
import { Patient } from './patient.entity';

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
@Index('UQ_patient_diagnoses_current', ['patientId'], {
  unique: true,
  where: '"is_current" = true',
})
@Index('IDX_patient_diagnoses_patient_id', ['patientId'])
@Index('IDX_patient_diagnoses_interaction_id', ['interactionId'])
@Index('IDX_patient_diagnoses_health_center_id', ['healthCenterId'])
export class PatientDiagnosis {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'interaction_id', type: 'uuid' }) interactionId!: string;
  @ManyToOne(() => Interaction)
  @JoinColumn({ name: 'interaction_id' })
  interaction!: Interaction;
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
  @Column({
    name: 'diagnosis_specialty',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  diagnosisSpecialty!: string | null;
  @Column({ name: 'symptom_leading_to_checkup', type: 'text', nullable: true })
  symptomLeadingToCheckup!: string | null;
  @Column({
    name: 'wait_time_for_diagnosis',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  waitTimeForDiagnosis!: string | null;
  @Column({ name: 'has_medical_report', type: 'boolean', default: false })
  hasMedicalReport!: boolean;
  @Column({ name: 'is_current', type: 'boolean' }) isCurrent!: boolean;
  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
