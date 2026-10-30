import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Companion } from './companion.entity';
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

/** CH1: un acompañante interesado en una charla (catálogo educational_talk). */
@Entity('companion_talk_interests')
@Index('UQ_companion_talk_interests_companion_talk', ['companionId', 'talk'], {
  unique: true,
})
@Index('IDX_companion_talk_interests_patient_id', ['patientId'])
@Index('IDX_companion_talk_interests_talk', ['talk'])
export class CompanionTalkInterest {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'companion_id', type: 'uuid' })
  companionId!: string;

  @ManyToOne(() => Companion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companion_id' })
  companion!: Companion;

  /** Paciente desde cuya ficha se registró (alcance de permisos y listados). */
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ type: 'varchar', length: 100 })
  talk!: string;

  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;

  @ManyToOne(() => FollowUp, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
