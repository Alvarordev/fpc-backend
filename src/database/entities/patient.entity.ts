import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeactivationReason } from './deactivation-reason.enum';
import { PatientDetails } from './patient-details.entity';
import { PatientRole } from './patient-role.enum';
import { PatientStatus } from './patient-status.enum';

@Entity('patients')
@Check("\"role\" IN ('UNKNOWN', 'PATIENT', 'COMPANION')")
@Check("\"status\" IN ('UNENROLLED', 'ENROLLED')")
@Check(
  "\"deactivation_reason\" IN ('DECEASED', 'WITHDREW_CONSENT', 'LOST_CONTACT', 'TRANSFERRED_OUT', 'OTHER')",
)
@Check(
  '(("is_active" = true AND "deactivation_reason" IS NULL AND "deactivated_at" IS NULL AND "deactivation_reason_detail" IS NULL) OR ("is_active" = false AND "deactivation_reason" IS NOT NULL AND "deactivated_at" IS NOT NULL AND (("deactivation_reason" = \'OTHER\' AND "deactivation_reason_detail" IS NOT NULL) OR ("deactivation_reason" != \'OTHER\' AND "deactivation_reason_detail" IS NULL))))',
)
@Check('"role" != \'COMPANION\' OR "accompanies_patient_id" IS NOT NULL')
@Index('IDX_patients_dni', ['dni'])
@Index('IDX_patients_role', ['role'])
@Index('IDX_patients_status', ['status'])
@Index('IDX_patients_accompanies_patient_id', ['accompaniesPatientId'])
export class Patient {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  dni!: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender!: string | null;

  @Column({ name: 'primary_phone', type: 'varchar', length: 50 })
  primaryPhone!: string;

  @Column({
    name: 'secondary_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  secondaryPhone!: string | null;

  @Column({ name: 'has_whatsapp', type: 'boolean', default: false })
  hasWhatsapp!: boolean;

  @Column({ type: 'varchar', length: 20, default: PatientRole.UNKNOWN })
  role!: PatientRole;

  @Column({ type: 'varchar', length: 20, default: PatientStatus.UNENROLLED })
  status!: PatientStatus;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({
    name: 'deactivation_reason',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  deactivationReason!: DeactivationReason | null;

  @Column({
    name: 'deactivation_reason_detail',
    type: 'text',
    nullable: true,
  })
  deactivationReasonDetail!: string | null;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt!: Date | null;

  @Column({ name: 'deceased_at', type: 'date', nullable: true })
  deceasedAt!: string | null;

  @Column({ name: 'accompanies_patient_id', type: 'uuid', nullable: true })
  accompaniesPatientId!: string | null;

  @ManyToOne(() => Patient, (patient) => patient.companions)
  @JoinColumn({ name: 'accompanies_patient_id' })
  accompaniesPatient!: Patient | null;

  @OneToMany(() => Patient, (patient) => patient.accompaniesPatient)
  companions!: Patient[];

  @Column({ name: 'is_primary_informant', type: 'boolean', default: false })
  isPrimaryInformant!: boolean;

  @OneToOne(() => PatientDetails, (details) => details.patient)
  details!: PatientDetails | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
