import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Duration } from './embedded/duration.embedded';
import { HealthCenter } from './health-center.entity';

@Entity('patient_details')
@Check(
  'CHK_patient_details_children_count_non_negative',
  '"children_count" IS NULL OR "children_count" >= 0',
)
@Index('IDX_patient_details_health_phase', ['healthPhase'])
@Index('IDX_patient_details_health_subcategory', ['healthSubcategory'])
export class PatientDetails {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'health_phase', type: 'varchar', length: 100, nullable: true })
  healthPhase!: string | null;

  @Column({
    name: 'health_subcategory',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  healthSubcategory!: string | null;

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

  @Column({
    name: 'birth_country',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  birthCountry!: string | null;

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

  @Column({ name: 'zone_type', type: 'varchar', length: 100, nullable: true })
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
    length: 100,
    nullable: true,
  })
  educationLevel!: string | null;

  @Column({
    name: 'native_language',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  nativeLanguage!: string | null;

  @Column({ name: 'children_count', type: 'int', nullable: true })
  childrenCount!: number | null;

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

  @Column({ name: 'transportation_via_sepa', type: 'boolean', nullable: true })
  transportationViaSepa!: boolean | null;

  @Column({
    name: 'transportation_sepa_provider',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  transportationSepaProvider!: string | null;

  @Column({
    name: 'transportation_sepa_provider_other',
    type: 'text',
    nullable: true,
  })
  transportationSepaProviderOther!: string | null;

  @Column({ name: 'shelter_via_sepa', type: 'boolean', nullable: true })
  shelterViaSepa!: boolean | null;

  @Column({
    name: 'shelter_sepa_provider',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  shelterSepaProvider!: string | null;

  @Column({ name: 'shelter_sepa_provider_other', type: 'text', nullable: true })
  shelterSepaProviderOther!: string | null;

  @Column({
    name: 'attended_educational_talk',
    type: 'boolean',
    nullable: true,
  })
  attendedEducationalTalk!: boolean | null;

  @Column({
    name: 'attended_educational_talk_at',
    type: 'date',
    nullable: true,
  })
  attendedEducationalTalkAt!: string | null;

  @Column({
    name: 'program_dropout_reason_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  programDropoutReasonCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
