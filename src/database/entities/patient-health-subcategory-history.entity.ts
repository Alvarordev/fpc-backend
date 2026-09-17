import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PatientHealthSubcategory } from './patient-health-subcategory.enum';
import { Patient } from './patient.entity';

@Entity('patient_health_subcategory_history')
@Index('IDX_patient_health_subcategory_history_patient_changed_at', [
  'patientId',
  'changedAt',
])
export class PatientHealthSubcategoryHistory {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'health_subcategory', type: 'varchar', length: 40 })
  healthSubcategory!: PatientHealthSubcategory;

  @Column({
    name: 'changed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  changedAt!: Date;
}
