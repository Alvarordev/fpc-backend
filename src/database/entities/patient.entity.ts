import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeactivationReason } from './deactivation-reason.enum';
import { PatientActivityStatus } from './patient-activity-status.enum';
import { PatientDetails } from './patient-details.entity';
import { PatientRole } from './patient-role.enum';
import { PatientStatus } from './patient-status.enum';

@Entity('patients')
@Check("\"role\" IN ('UNKNOWN', 'PATIENT', 'COMPANION')")
@Check("\"status\" IN ('UNENROLLED', 'ENROLLED')")
@Check(
  'CHK_patients_activity_status',
  "\"activity_status\" IN ('ACTIVE', 'INACTIVE', 'REACTIVE')",
)
@Check(
  "\"deactivation_reason\" IN ('DECEASED', 'WITHDREW_CONSENT', 'LOST_CONTACT', 'TRANSFERRED_OUT', 'OTHER')",
)
@Check(
  'CHK_patients_activity_deactivation',
  '(("activity_status" IN (\'ACTIVE\', \'REACTIVE\') AND "deactivation_reason" IS NULL AND "deactivated_at" IS NULL AND "deactivation_reason_detail" IS NULL) OR ("activity_status" = \'INACTIVE\' AND "deactivation_reason" IS NOT NULL AND "deactivated_at" IS NOT NULL AND (("deactivation_reason" = \'OTHER\' AND "deactivation_reason_detail" IS NOT NULL) OR ("deactivation_reason" != \'OTHER\' AND "deactivation_reason_detail" IS NULL)))))',
)
@Index('IDX_patients_dni', ['dni'])
@Index('IDX_patients_role', ['role'])
@Index('IDX_patients_status', ['status'])
@Index('IDX_patients_activity_status', ['activityStatus'])
@Index('IDX_patients_created_at_id', ['createdAt', 'id'])
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

  @Column({
    name: 'activity_status',
    type: 'varchar',
    length: 20,
    default: PatientActivityStatus.ACTIVE,
  })
  activityStatus!: PatientActivityStatus;

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

  @OneToOne(() => PatientDetails, (details) => details.patient)
  details!: PatientDetails | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
