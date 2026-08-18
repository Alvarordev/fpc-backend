import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PatientHealthPhase } from './patient-health-phase.enum';
import { Patient } from './patient.entity';

@Entity('patient_health_phase_history')
@Index('IDX_patient_health_phase_history_patient_changed_at', [
  'patientId',
  'changedAt',
])
export class PatientHealthPhaseHistory {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'health_phase', type: 'varchar', length: 30 })
  healthPhase!: PatientHealthPhase;

  @Column({
    name: 'changed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  changedAt!: Date;
}
