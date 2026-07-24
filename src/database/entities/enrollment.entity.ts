import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Interaction } from './interaction.entity';
import { Patient } from './patient.entity';

export enum AffiliationType {
  SELF = 'SELF',
  FAMILY_FRIEND = 'FAMILY_FRIEND',
}

@Entity('enrollments')
@Check(`"affiliation_type" IN ('SELF','FAMILY_FRIEND')`)
@Check(
  '"interaction_quality_rating" IS NULL OR "interaction_quality_rating" BETWEEN 1 AND 5',
)
@Index('IDX_enrollments_patient_id', ['patientId'])
@Index('IDX_enrollments_interaction_id', ['interactionId'])
@Index('IDX_enrollments_companion_id', ['companionId'])
export class Enrollment {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'interaction_id', type: 'uuid' }) interactionId!: string;
  @ManyToOne(() => Interaction)
  @JoinColumn({ name: 'interaction_id' })
  interaction!: Interaction;
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
  @Column({
    name: 'interaction_quality_rating',
    type: 'smallint',
    nullable: true,
  })
  interactionQualityRating!: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
