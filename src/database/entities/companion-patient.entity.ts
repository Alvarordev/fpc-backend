import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { Patient } from './patient.entity';
import { CompanionContactRole } from './companion-contact-role.enum';

@Entity('companion_patient')
@Check(
  'CHK_companion_patient_contact_role',
  `"contact_role" IS NULL OR "contact_role" IN ('PRIMARY', 'SECONDARY')`,
)
@Unique(['companionId', 'patientId'])
@Index('IDX_companion_patient_companion_id', ['companionId'])
@Index('IDX_companion_patient_patient_id', ['patientId'])
@Index('UQ_companion_patient_primary_contact', ['patientId'], {
  unique: true,
  where: `"contact_role" = 'PRIMARY'`,
})
@Index('UQ_companion_patient_secondary_contact', ['patientId'], {
  unique: true,
  where: `"contact_role" = 'SECONDARY'`,
})
export class CompanionPatient {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'companion_id', type: 'uuid' }) companionId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'companion_id' })
  companion!: Patient;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'is_primary_informant', type: 'boolean', default: false })
  isPrimaryInformant!: boolean;
  @Column({ name: 'is_primary_contact', type: 'boolean', default: false })
  isPrimaryContact!: boolean;
  @Column({ name: 'contact_role', type: 'varchar', length: 10, nullable: true })
  contactRole!: CompanionContactRole | null;
  @Column({ name: 'is_caregiver', type: 'boolean', default: false })
  isCaregiver!: boolean;
  @Column({ name: 'relationship', type: 'varchar', length: 50, nullable: true })
  relationship!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
