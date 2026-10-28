import {
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
import { PsychooncologyAppointment } from './psychooncology-appointment.entity';
import { User } from './user.entity';

export enum SurveyType {
  ENROLLMENT = 'ENROLLMENT',
  THREE_MONTHS = 'THREE_MONTHS',
  PSYCHOONCOLOGY = 'PSYCHOONCOLOGY',
  TALK = 'TALK',
}

export enum SurveyChannel {
  CALL = 'CALL',
  WHATSAPP = 'WHATSAPP',
  VIDEO_CALL = 'VIDEO_CALL',
  EMAIL = 'EMAIL',
  IN_PERSON = 'IN_PERSON',
  FORM = 'FORM',
}

/** A satisfaction answer (1–5) collected by an agent or imported (EN1). */
@Entity('surveys')
@Index('IDX_surveys_patient_type', ['patientId', 'type'])
@Index('IDX_surveys_answered_at', ['answeredAt'])
export class Survey {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ type: 'varchar', length: 20 }) type!: SurveyType;
  @Column({ type: 'smallint' }) rating!: number;
  @Column({ type: 'text', nullable: true }) comment!: string | null;
  @Column({ type: 'varchar', length: 20 }) channel!: SurveyChannel;

  @Column({ name: 'answered_at', type: 'timestamptz' }) answeredAt!: Date;

  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;
  @ManyToOne(() => FollowUp, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp | null;

  @Column({
    name: 'psychooncology_appointment_id',
    type: 'uuid',
    nullable: true,
  })
  psychooncologyAppointmentId!: string | null;
  @ManyToOne(() => PsychooncologyAppointment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'psychooncology_appointment_id' })
  psychooncologyAppointment!: PsychooncologyAppointment | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_user_id' })
  actor!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
