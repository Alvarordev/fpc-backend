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
import { Duration } from './embedded/duration.embedded';
import { LodgingCostPeriod } from './lodging-cost-period.enum';

@Entity('patient_addresses')
@Check(`"type" IN ('PERMANENT', 'TEMPORARY')`)
@Check(
  `"department" IS NULL OR "department" IN (${PERU_DEPARTMENTS.map((department) => `'${department}'`).join(', ')})`,
)
@Index('UQ_patient_addresses_primary', ['patientId'], {
  unique: true,
  where: '"is_primary" = true AND "is_active" = true',
})
@Check(
  'CHK_patient_addresses_lodging_cost_period',
  `"average_lodging_cost_period" IS NULL OR "average_lodging_cost_period" IN ('NIGHT', 'MONTH')`,
)
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
  /** Catalog `location_share_status`: whether the web location was shared. */
  @Column({
    name: 'location_share_status',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  locationShareStatus!: string | null;
  @Column({ name: 'location_share_status_other', type: 'text', nullable: true })
  locationShareStatusOther!: string | null;
  /** Catalog `temporary_housing_type`; only for TEMPORARY addresses. */
  @Column({
    name: 'housing_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  housingType!: string | null;
  @Column({ name: 'housing_type_other', type: 'text', nullable: true })
  housingTypeOther!: string | null;
  @Column({ name: 'shelter_name', type: 'text', nullable: true })
  shelterName!: string | null;
  @Column(() => Duration, { prefix: 'travel_time_to_hospital' })
  travelTimeToHospital!: Duration;
  /** Average spend in soles when renting lodging near the hospital. */
  @Column({
    name: 'average_lodging_cost',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  averageLodgingCost!: string | null;
  @Column({
    name: 'average_lodging_cost_period',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  averageLodgingCostPeriod!: LodgingCostPeriod | null;
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
