import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Alert } from './alert.entity';
import { FollowUp } from './follow-up.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('alert_reports')
@Index('UQ_alert_reports_alert_follow_up', ['alertId', 'followUpId'], {
  unique: true,
})
@Index('IDX_alert_reports_patient_id', ['patientId'])
@Index('IDX_alert_reports_follow_up_id', ['followUpId'])
export class AlertReport {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'alert_id', type: 'uuid' }) alertId!: string;
  @ManyToOne(() => Alert, (alert) => alert.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_id' })
  alert!: Alert;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'reported_at', type: 'timestamptz', default: () => 'now()' })
  reportedAt!: Date;
  @Column({ name: 'reported_by_user_id', type: 'uuid', nullable: true })
  reportedByUserId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reported_by_user_id' })
  reportedByUser!: User | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
