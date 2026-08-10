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
import { HealthCenter } from './health-center.entity';
import { Patient } from './patient.entity';

@Entity('patient_referrals')
@Index('IDX_patient_referrals_patient_id', ['patientId'])
@Index('IDX_patient_referrals_from_health_center_id', ['fromHealthCenterId'])
@Index('IDX_patient_referrals_to_health_center_id', ['toHealthCenterId'])
export class PatientReferral {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp | null;
  @Column({ name: 'from_health_center_id', type: 'uuid', nullable: true })
  fromHealthCenterId!: string | null;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'from_health_center_id' })
  fromHealthCenter!: HealthCenter | null;
  @Column({ name: 'to_health_center_id', type: 'uuid' })
  toHealthCenterId!: string;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'to_health_center_id' })
  toHealthCenter!: HealthCenter;
  @Column({ type: 'varchar', length: 255, nullable: true }) specialty!:
    string | null;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ name: 'referral_date', type: 'date', nullable: true })
  referralDate!: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  @Column({ name: 'has_referral_sheet', type: 'boolean', default: false })
  hasReferralSheet!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
