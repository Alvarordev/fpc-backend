import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';

/** Seed codes for insurance_type. New options live in catalog_items. */
export enum InsuranceType {
  SIS = 'SIS',
  ESSALUD = 'ESSALUD',
  EPS = 'EPS',
  FUERZAS_ARMADAS = 'FUERZAS_ARMADAS',
  SALUDPOL = 'SALUDPOL',
  NONE = 'NONE',
}

/** Seed codes for eps_provider. New options live in catalog_items. */
export enum EpsProvider {
  RIMAC = 'RIMAC',
  PACIFICO = 'PACIFICO',
  MAPFRE = 'MAPFRE',
  SANITAS = 'SANITAS',
  LA_POSITIVA = 'LA_POSITIVA',
  ONCOSALUD = 'ONCOSALUD',
  OTHER = 'OTHER',
}

@Entity('patient_insurance')
@Index('UQ_patient_insurance_current', ['patientId'], {
  unique: true,
  where: '"is_current" = true',
})
@Index('IDX_patient_insurance_patient_id', ['patientId'])
@Index('IDX_patient_insurance_follow_up_id', ['followUpId'])
export class PatientInsurance {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'insurance_type', type: 'varchar', length: 100 })
  insuranceType!: string;
  @Column({ name: 'eps_provider', type: 'varchar', length: 100, nullable: true })
  epsProvider!: string | null;
  @Column({ name: 'is_current', type: 'boolean' }) isCurrent!: boolean;
  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason!: string | null;
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!:
    string | null;
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!:
    string | null;
  @Column({ name: 'affiliated_via_sepa', type: 'boolean', nullable: true })
  affiliatedViaSepa!: boolean | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
