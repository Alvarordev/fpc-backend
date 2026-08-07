import {
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
import { PatientDiagnosis } from './patient-diagnosis.entity';
import { Patient } from './patient.entity';

@Entity('patient_treatments')
@Index('UQ_patient_treatments_current', ['diagnosisId'], {
  unique: true,
  where: '"is_current" = true',
})
@Index('IDX_patient_treatments_patient_id', ['patientId'])
@Index('IDX_patient_treatments_follow_up_id', ['followUpId'])
@Index('IDX_patient_treatments_diagnosis_id', ['diagnosisId'])
@Index('IDX_patient_treatments_health_center_id', ['healthCenterId'])
export class PatientTreatment {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'diagnosis_id', type: 'uuid' }) diagnosisId!: string;
  @ManyToOne(() => PatientDiagnosis)
  @JoinColumn({ name: 'diagnosis_id' })
  diagnosis!: PatientDiagnosis;
  @Column({ name: 'treatment_type', type: 'varchar', length: 255 })
  treatmentType!: string;
  @Column({
    name: 'treatment_frequency',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  treatmentFrequency!: string | null;
  @Column({ name: 'health_center_id', type: 'uuid', nullable: true })
  healthCenterId!: string | null;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'health_center_id' })
  healthCenter!: HealthCenter | null;
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!:
    string | null;
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!:
    string | null;
  @Column({ name: 'is_current', type: 'boolean' }) isCurrent!: boolean;
  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason!: string | null;
  @Column({ name: 'not_receiving_reason', type: 'text', nullable: true })
  notReceivingReason!: string | null;
  @Column({
    name: 'treatment_situation',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  treatmentSituation!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
