import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { PatientHealthPhase } from './patient-health-phase.enum';
import { PatientHealthSubcategory } from './patient-health-subcategory.enum';

/**
 * Datos propios de un seguimiento de reenrolamiento (purpose REENROLLMENT).
 * El paciente inactivo vuelve al programa sin pasar otra vez por el enrolamiento.
 */
@Entity('follow_up_reenrollments')
@Index('IDX_follow_up_reenrollments_patient_id', ['patientId'])
@Index('UQ_follow_up_reenrollments_follow_up_id', ['followUpId'], {
  unique: true,
})
export class FollowUpReenrollment {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'follow_up_id', type: 'uuid' })
  followUpId!: string;

  @OneToOne(() => FollowUp, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  /** Catálogo reenrollment_reason. */
  @Column({ type: 'varchar', length: 100 })
  reason!: string;

  @Column({ name: 'entry_source', type: 'varchar', length: 100 })
  entrySource!: string;

  @Column({
    name: 'entry_sub_source',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  entrySubSource!: string | null;

  @Column({ name: 'health_phase', type: 'varchar', length: 50 })
  healthPhase!: PatientHealthPhase;

  @Column({
    name: 'health_subcategory',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  healthSubcategory!: PatientHealthSubcategory | null;

  /** El agente revisó teléfono, dirección, seguro y contacto principal. */
  @Column({ name: 'contact_data_confirmed_at', type: 'timestamptz' })
  contactDataConfirmedAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
