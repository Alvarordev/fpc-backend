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
import { User } from './user.entity';

export enum SocialNoteType {
  SOCIAL_WORKER = 'SOCIAL_WORKER',
  CONADIS = 'CONADIS',
  FISSAL = 'FISSAL',
}

@Entity('patient_social_notes')
@Check(`"type" IN ('SOCIAL_WORKER','CONADIS','FISSAL')`)
@Index('IDX_patient_social_notes_patient_created_at_id', [
  'patientId',
  'createdAt',
  'id',
])
@Index('IDX_patient_social_notes_follow_up_id', ['followUpId'])
@Index('IDX_patient_social_notes_author_id', ['authorId'])
export class PatientSocialNote {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;

  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;

  @Column({ type: 'varchar', length: 20 }) type!: SocialNoteType;

  @Column({ type: 'text' }) note!: string;

  @Column({ name: 'author_id', type: 'uuid' }) authorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
