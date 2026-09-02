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
import { User } from './user.entity';

export enum AffiliationType {
  SELF = 'SELF',
  FAMILY_FRIEND = 'FAMILY_FRIEND',
}

@Entity('enrollments')
@Check(`"affiliation_type" IN ('SELF','FAMILY_FRIEND')`)
@Check(
  '"follow_up_quality_rating" IS NULL OR "follow_up_quality_rating" BETWEEN 1 AND 5',
)
@Index('IDX_enrollments_patient_id', ['patientId'])
@Index('IDX_enrollments_follow_up_id', ['followUpId'])
@Index('IDX_enrollments_companion_id', ['companionId'])
@Index('IDX_enrollments_enrolled_on', ['enrolledOn', 'createdAt', 'id'])
@Index('IDX_enrollments_historical_loaded_by_id', ['historicalLoadedById'])
@Index('UQ_enrollments_patient_id_operational', ['patientId'], {
  unique: true,
  where: '"is_historical" = false',
})
export class Enrollment {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'enrolled_on', type: 'date' }) enrolledOn!: string;
  @Column({ name: 'affiliation_type', type: 'varchar', length: 20 })
  affiliationType!: AffiliationType;
  @Column({ name: 'companion_id', type: 'uuid', nullable: true })
  companionId!: string | null;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'companion_id' })
  companion!: Patient | null;
  @Column({
    name: 'currently_attending_consultations',
    type: 'boolean',
    nullable: true,
  })
  currentlyAttendingConsultations!: boolean | null;
  @Column({
    name: 'currently_receiving_treatment',
    type: 'boolean',
    nullable: true,
  })
  currentlyReceivingTreatment!: boolean | null;
  @Column({ name: 'entry_source', type: 'varchar', length: 50, nullable: true })
  entrySource!: string | null;
  @Column({
    name: 'entry_sub_source',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  entrySubSource!: string | null;
  @Column({ name: 'consent_to_contact', type: 'boolean', nullable: true })
  consentToContact!: boolean | null;
  @Column({ name: 'consent_to_share_data', type: 'boolean', nullable: true })
  consentToShareData!: boolean | null;
  @Column({ name: 'requires_transportation', type: 'boolean', nullable: true })
  requiresTransportation!: boolean | null;
  @Column({ name: 'has_mobility_issues', type: 'boolean', nullable: true })
  hasMobilityIssues!: boolean | null;
  @Column({ name: 'is_oncological_patient', type: 'boolean', default: false })
  isOncologicalPatient!: boolean;
  @Column({ name: 'survey_accepted', type: 'boolean', default: false })
  surveyAccepted!: boolean;
  @Column({ name: 'case_comments', type: 'text', nullable: true })
  caseComments!: string | null;
  @Column({ name: 'is_historical', type: 'boolean', default: false })
  isHistorical!: boolean;
  @Column({ name: 'historical_loaded_by_id', type: 'uuid', nullable: true })
  historicalLoadedById!: string | null;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'historical_loaded_by_id' })
  historicalLoadedBy!: User | null;
  @Column({ name: 'call_started_at', type: 'timestamptz', nullable: true })
  callStartedAt!: Date | null;
  @Column({ name: 'call_ended_at', type: 'timestamptz', nullable: true })
  callEndedAt!: Date | null;
  @Column({
    name: 'follow_up_quality_rating',
    type: 'smallint',
    nullable: true,
  })
  followUpQualityRating!: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
