import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EducationLevel } from './education-level.enum';
import { PatientHealthPhase } from './patient-health-phase.enum';
import { Patient } from './patient.entity';
import { Duration } from './embedded/duration.embedded';
import { HealthCenter } from './health-center.entity';

@Entity('patient_details')
@Check(
  "\"education_level\" IN ('INITIAL', 'PRIMARY_INCOMPLETE', 'PRIMARY', 'SECONDARY_INCOMPLETE', 'SECONDARY', 'TECHNICAL', 'TECHNICAL_INCOMPLETE', 'HIGHER', 'HIGHER_INCOMPLETE', 'NONE')",
)
@Check(
  'CHK_patient_details_health_phase',
  "\"health_phase\" IS NULL OR \"health_phase\" IN ('CANCER_DIAGNOSIS', 'ANNUAL_CHECKUP', 'SIGNS_AND_SYMPTOMS')",
)
export class PatientDetails {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'health_phase', type: 'varchar', length: 30, nullable: true })
  healthPhase!: PatientHealthPhase | null;

  @OneToOne(() => Patient, (patient) => patient.details, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({
    name: 'birth_department',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  birthDepartment!: string | null;

  @Column(() => Duration, { prefix: 'travel_time_to_hospital' })
  travelTimeToHospital!: Duration;

  @Column({ name: 'primary_health_center_id', type: 'uuid', nullable: true })
  primaryHealthCenterId!: string | null;

  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'primary_health_center_id' })
  primaryHealthCenter!: HealthCenter | null;

  @Column({
    name: 'emergency_contact_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  emergencyContactName!: string | null;

  @Column({
    name: 'emergency_contact_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  emergencyContactPhone!: string | null;

  @Column({ name: 'zone_type', type: 'varchar', length: 10, nullable: true })
  zoneType!: string | null;

  @Column({
    name: 'emergency_contact_gender',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  emergencyContactGender!: string | null;

  @Column({
    name: 'education_level',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  educationLevel!: EducationLevel | null;

  @Column({
    name: 'native_language',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  nativeLanguage!: string | null;

  @Column({ name: 'requires_translation', type: 'boolean', default: false })
  requiresTranslation!: boolean;
  @Column({
    name: 'referred_to_social_worker',
    type: 'boolean',
    nullable: true,
  })
  referredToSocialWorker!: boolean | null;

  @Column({
    name: 'evidence_of_domestic_violence',
    type: 'boolean',
    nullable: true,
  })
  evidenceOfDomesticViolence!: boolean | null;

  @Column({ name: 'uses_wood_stove', type: 'boolean', nullable: true })
  usesWoodStove!: boolean | null;

  @Column({ name: 'is_working', type: 'boolean', nullable: true })
  isWorking!: boolean | null;

  @Column({
    name: 'receives_financial_support',
    type: 'boolean',
    nullable: true,
  })
  receivesFinancialSupport!: boolean | null;

  @Column({ name: 'has_conadis_card', type: 'boolean', nullable: true })
  hasConadisCard!: boolean | null;

  @Column({ name: 'knows_about_fissal', type: 'boolean', nullable: true })
  knowsAboutFissal!: boolean | null;

  @Column({ name: 'program_dropout_reason', type: 'text', nullable: true })
  programDropoutReason!: string | null;

  @Column({ name: 'program_dropout_date', type: 'date', nullable: true })
  programDropoutDate!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
