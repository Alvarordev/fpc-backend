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
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';
import { AppointmentModality } from './psychooncology-appointment.entity';

@Entity('patient_psychooncology_support_assessments')
@Check(
  '"emotional_distress_score" IS NULL OR "emotional_distress_score" BETWEEN 1 AND 10',
)
@Check(
  `"preferred_modality" IS NULL OR "preferred_modality" IN ('CALL','VIDEO_CALL')`,
)
@Index('IDX_patient_psychooncology_support_assessments_patient_id', [
  'patientId',
])
@Index('IDX_patient_psychooncology_support_assessments_follow_up_id', [
  'followUpId',
])
export class PatientPsychooncologySupportAssessment {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;

  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;

  @Column({ name: 'excessive_worry', type: 'boolean', nullable: true })
  excessiveWorry!: boolean | null;

  @Column({
    name: 'emotional_distress_score',
    type: 'smallint',
    nullable: true,
  })
  emotionalDistressScore!: number | null;

  @Column({
    name: 'preferred_modality',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  preferredModality!: AppointmentModality | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
