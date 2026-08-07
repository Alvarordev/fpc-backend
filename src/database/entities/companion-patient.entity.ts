import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { Patient } from './patient.entity';

@Entity('companion_patient')
@Unique(['companionId', 'patientId'])
@Index('IDX_companion_patient_companion_id', ['companionId'])
@Index('IDX_companion_patient_patient_id', ['patientId'])
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
  @Column({ name: 'relationship', type: 'varchar', length: 50, nullable: true })
  relationship!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
