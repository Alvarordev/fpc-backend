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

@Entity('patient_sis_affiliation')
@Index('IDX_patient_sis_affiliation_patient_id', ['patientId'])
@Index('IDX_patient_sis_affiliation_follow_up_id', ['followUpId'])
export class PatientSisAffiliation {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'can_affiliate', type: 'boolean' }) canAffiliate!: boolean;
  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate!: string | null;
  @Column({ name: 'cant_affiliate_reason', type: 'text', nullable: true })
  cantAffiliateReason!: string | null;
  @Column({ name: 'affiliated_at', type: 'timestamptz', nullable: true })
  affiliatedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) comments!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
