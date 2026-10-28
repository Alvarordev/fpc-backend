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
import { HealthCenter } from './health-center.entity';
import { PatientDocument } from './patient-document.entity';
import { Patient } from './patient.entity';

export enum ReferralType {
  FORMAL = 'FORMAL',
  SELF = 'SELF',
}

export enum ReferralStatus {
  REQUESTED = 'REQUESTED',
  ISSUED = 'ISSUED',
  ATTENDED = 'ATTENDED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

@Entity('referrals')
@Check(`"type" IN ('FORMAL', 'SELF')`)
@Check(`"status" IN ('REQUESTED', 'ISSUED', 'ATTENDED', 'REJECTED', 'EXPIRED')`)
@Index('IDX_referrals_patient_id_requested_on', ['patientId', 'requestedOn'])
@Index('IDX_referrals_destination_health_center_id', [
  'destinationHealthCenterId',
])
export class Referral {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;
  @Column({ name: 'origin_health_center_id', type: 'uuid', nullable: true })
  originHealthCenterId!: string | null;
  @ManyToOne(() => HealthCenter, { nullable: true })
  @JoinColumn({ name: 'origin_health_center_id' })
  originHealthCenter?: HealthCenter | null;
  @Column({
    name: 'destination_health_center_id',
    type: 'uuid',
    nullable: true,
  })
  destinationHealthCenterId!: string | null;
  @ManyToOne(() => HealthCenter, { nullable: true })
  @JoinColumn({ name: 'destination_health_center_id' })
  destinationHealthCenter?: HealthCenter | null;
  /** medical_specialty catalog code. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  specialty!: string | null;
  @Column({ type: 'varchar', length: 10 }) type!: ReferralType;
  @Column({ type: 'varchar', length: 10 }) status!: ReferralStatus;
  @Column({ name: 'requested_on', type: 'date' }) requestedOn!: string;
  @Column({ name: 'issued_on', type: 'date', nullable: true })
  issuedOn!: string | null;
  @Column({ name: 'attended_on', type: 'date', nullable: true })
  attendedOn!: string | null;
  @Column({ name: 'via_sepa', type: 'boolean', default: false })
  viaSepa!: boolean;
  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;
  @ManyToOne(() => FollowUp, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'follow_up_id' })
  followUp?: FollowUp | null;
  @Column({
    name: 'referral_sheet_document_id',
    type: 'uuid',
    nullable: true,
  })
  referralSheetDocumentId!: string | null;
  @ManyToOne(() => PatientDocument, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'referral_sheet_document_id' })
  referralSheetDocument?: PatientDocument | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
