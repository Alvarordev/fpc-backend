import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';
import { PERU_DEPARTMENTS, PeruDepartment } from './health-center.entity';
import { AddressType } from './address-type.enum';

@Entity('patient_addresses')
@Check(`"type" IN ('PERMANENT', 'TEMPORARY')`)
@Check(
  `"department" IS NULL OR "department" IN (${PERU_DEPARTMENTS.map((department) => `'${department}'`).join(', ')})`,
)
@Index('UQ_patient_addresses_primary', ['patientId'], {
  unique: true,
  where: '"is_primary" = true AND "is_active" = true',
})
@Index('IDX_patient_addresses_patient_id', ['patientId'])
@Index('IDX_patient_addresses_department', ['department'])
export class PatientAddress {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp | null;
  @Column({ type: 'varchar', length: 20 }) type!: AddressType;
  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;
  @Column({ type: 'text', nullable: true }) address!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) district!:
    string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) province!:
    string | null;
  @Column({ type: 'varchar', length: 50, nullable: true })
  department!: PeruDepartment | null;
  @Column({ type: 'text', nullable: true }) reference!: string | null;
  @Column({ name: 'location_url', type: 'text', nullable: true })
  locationUrl!: string | null;
  @Column({ name: 'dni_matches_address', type: 'boolean', nullable: true })
  dniMatchesAddress!: boolean | null;
  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom!: string | null;
  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo!: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
