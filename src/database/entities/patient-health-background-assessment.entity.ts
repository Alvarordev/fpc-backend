import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';

export enum LimitationCause {
  DIAGNOSIS = 'DIAGNOSIS',
  TREATMENT = 'TREATMENT',
  NATURAL_CONDITION = 'NATURAL_CONDITION',
}

@Entity('patient_health_background_assessments')
@Index('IDX_patient_health_background_assessments_patient_id', ['patientId'])
@Index('IDX_patient_health_background_assessments_follow_up_id', ['followUpId'])
export class PatientHealthBackgroundAssessment {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;

  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;

  @Column({ name: 'has_psychiatry', type: 'boolean', nullable: true })
  hasPsychiatry!: boolean | null;

  @OneToMany(() => PatientActiveComorbidity, (item) => item.assessment)
  activeComorbidities!: PatientActiveComorbidity[];

  @OneToMany(() => PatientLimitation, (item) => item.assessment)
  limitations!: PatientLimitation[];

  @OneToMany(() => PatientFamilyCancerHistory, (item) => item.assessment)
  familyCancerHistory!: PatientFamilyCancerHistory[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('patient_active_comorbidities')
@Index('IDX_patient_active_comorbidities_assessment_id', ['assessmentId'])
export class PatientActiveComorbidity {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'assessment_id', type: 'uuid' }) assessmentId!: string;

  @ManyToOne(
    () => PatientHealthBackgroundAssessment,
    (item) => item.activeComorbidities,
  )
  @JoinColumn({ name: 'assessment_id' })
  assessment!: PatientHealthBackgroundAssessment;

  @Column({ name: 'condition_name', type: 'varchar', length: 255 })
  conditionName!: string;

  @Column({ name: 'treatment_description', type: 'text', nullable: true })
  treatmentDescription!: string | null;

  @Column({
    name: 'follow_up_specialty',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  followUpSpecialty!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('patient_limitations')
@Index('IDX_patient_limitations_assessment_id', ['assessmentId'])
export class PatientLimitation {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'assessment_id', type: 'uuid' }) assessmentId!: string;

  @ManyToOne(
    () => PatientHealthBackgroundAssessment,
    (item) => item.limitations,
  )
  @JoinColumn({ name: 'assessment_id' })
  assessment!: PatientHealthBackgroundAssessment;

  @Column({ type: 'text' }) description!: string;

  @Column({ type: 'varchar', length: 30 }) cause!: LimitationCause;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('patient_family_cancer_history')
@Index('IDX_patient_family_cancer_history_assessment_id', ['assessmentId'])
export class PatientFamilyCancerHistory {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'assessment_id', type: 'uuid' }) assessmentId!: string;

  @ManyToOne(
    () => PatientHealthBackgroundAssessment,
    (item) => item.familyCancerHistory,
  )
  @JoinColumn({ name: 'assessment_id' })
  assessment!: PatientHealthBackgroundAssessment;

  @Column({ type: 'varchar', length: 255 }) relationship!: string;

  @Column({ name: 'cancer_type', type: 'varchar', length: 255, nullable: true })
  cancerType!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
