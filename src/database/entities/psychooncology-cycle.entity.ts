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
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum PsychooncologyCycleCloseReason {
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
  NOT_NEEDED = 'NOT_NEEDED',
}

/** Base number of sessions of a cycle; more are scheduled as additional. */
export const PSYCHOONCOLOGY_BASE_CYCLE_SESSIONS = 4;

@Entity('psychooncology_cycles')
@Check(
  `"close_reason" IS NULL OR "close_reason" IN ('COMPLETED','ABANDONED','NOT_NEEDED')`,
)
@Check(`("closed_at" IS NULL) = ("close_reason" IS NULL)`)
@Index('IDX_psychooncology_cycles_patient_id', ['patientId'])
@Index('UQ_psychooncology_cycles_open_patient', ['patientId'], {
  unique: true,
  where: '"closed_at" IS NULL',
})
export class PsychooncologyCycle {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'opened_at', type: 'timestamptz' }) openedAt!: Date;
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;
  @Column({ name: 'close_reason', type: 'varchar', length: 20, nullable: true })
  closeReason!: PsychooncologyCycleCloseReason | null;
  @Column({ name: 'closed_by_id', type: 'uuid', nullable: true })
  closedById!: string | null;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by_id' })
  closedBy!: User | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
