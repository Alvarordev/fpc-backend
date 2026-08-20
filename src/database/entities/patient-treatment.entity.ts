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
import { PatientDiagnosis } from './patient-diagnosis.entity';
import { Patient } from './patient.entity';
import { Duration } from './embedded/duration.embedded';
import { CareProgram } from './care-program.enum';
import { TreatmentSituation } from './treatment-situation.enum';

@Entity('patient_treatments')
@Check(
  `"treatment_situation" IS NULL OR "treatment_situation" IN ('EN_CURSO','PENDIENTE_DE_INICIO','INTERRUMPIDO','FINALIZADO','SEARCHING','ABANDONED','DECEASED_DURING_TREATMENT','NOT_APPLICABLE','REMISSION')`,
)
@Check(`"care_program" IS NULL OR "care_program" IN ('COPHOES','PADOMI')`)
@Check(
  '"is_referred" = false AND "source_health_center_id" IS NULL OR "is_referred" = true AND "source_health_center_id" IS NOT NULL AND "receiving_health_center_id" IS NOT NULL AND "source_health_center_id" <> "receiving_health_center_id"',
)
@Index('UQ_patient_treatments_current', ['seriesId'], {
  unique: true,
  where: '"is_current" = true',
})
@Index('IDX_patient_treatments_patient_id', ['patientId'])
@Index('IDX_patient_treatments_follow_up_id', ['followUpId'])
@Index('IDX_patient_treatments_diagnosis_id', ['diagnosisId'])
@Index('IDX_patient_treatments_source_health_center_id', [
  'sourceHealthCenterId',
])
@Index('IDX_patient_treatments_receiving_health_center_id', [
  'receivingHealthCenterId',
])
@Index('IDX_patient_treatments_series_id', ['seriesId'])
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
  @Column({ name: 'series_id', type: 'uuid' }) seriesId!: string;
  @Column({ name: 'treatment_type', type: 'varchar', length: 255 })
  treatmentType!: string;
  @Column(() => Duration, { prefix: 'treatment_frequency' })
  treatmentFrequency!: Duration;
  @Column({ name: 'is_referred', type: 'boolean', default: false })
  isReferred!: boolean;
  @Column({ name: 'source_health_center_id', type: 'uuid', nullable: true })
  sourceHealthCenterId!: string | null;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'source_health_center_id' })
  sourceHealthCenter!: HealthCenter | null;
  @Column({ name: 'receiving_health_center_id', type: 'uuid', nullable: true })
  receivingHealthCenterId!: string | null;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'receiving_health_center_id' })
  receivingHealthCenter!: HealthCenter | null;
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
    name: 'operation_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  operationName!: string | null;
  @Column({ name: 'care_program', type: 'varchar', length: 10, nullable: true })
  careProgram!: CareProgram | null;
  @Column({
    name: 'receives_teleconsultation',
    type: 'boolean',
    nullable: true,
  })
  receivesTeleconsultation!: boolean | null;
  @Column({ name: 'teleconsultation_note', type: 'text', nullable: true })
  teleconsultationNote!: string | null;
  @Column({
    name: 'teleconsultation_specialties',
    type: 'text',
    array: true,
    nullable: true,
  })
  teleconsultationSpecialties!: string[] | null;
  @Column({
    name: 'treatment_situation',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  treatmentSituation!: TreatmentSituation | null;
  @Column({
    name: 'treatment_abandonment_reason',
    type: 'text',
    nullable: true,
  })
  treatmentAbandonmentReason!: string | null;
  @Column({ name: 'has_latest_prescription', type: 'boolean', nullable: true })
  hasLatestPrescription!: boolean | null;
  @Column({ name: 'latest_prescription_date', type: 'date', nullable: true })
  latestPrescriptionDate!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
