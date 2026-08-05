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
import { Agent } from './agent.entity';
import { HealthCenter } from './health-center.entity';
import { FollowUp } from './follow-up.entity';
import { User } from './user.entity';
export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
}
export enum AlertSeverity {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}
export enum AlertCategory {
  GENERAL = 'GENERAL',
  MEDICATION_SHORTAGE = 'MEDICATION_SHORTAGE',
  APPOINTMENT_DELAY = 'APPOINTMENT_DELAY',
  INSURANCE_COVERAGE = 'INSURANCE_COVERAGE',
  TRANSPORT = 'TRANSPORT',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  PSYCHOSOCIAL = 'PSYCHOSOCIAL',
  OTHER = 'OTHER',
}
@Entity('alerts')
@Check(`"status" IN ('ACTIVE','RESOLVED')`)
@Check(`"severity" IN ('HIGH','MEDIUM','LOW')`)
@Check(
  `"category" IN ('GENERAL','MEDICATION_SHORTAGE','APPOINTMENT_DELAY','INSURANCE_COVERAGE','TRANSPORT','ADMINISTRATIVE','PSYCHOSOCIAL','OTHER')`,
)
@Index('IDX_alerts_health_center_id', ['healthCenterId'])
@Index('IDX_alerts_follow_up_id', ['followUpId'])
@Index('IDX_alerts_created_by_id', ['createdById'])
@Index('IDX_alerts_resolved_by_id', ['resolvedById'])
@Index('IDX_alerts_resolved_by_user_id', ['resolvedByUserId'])
@Index('IDX_alerts_status', ['status'])
@Index('UQ_alerts_ticket_number', ['ticketNumber'], { unique: true })
@Index('IDX_alerts_severity', ['severity'])
@Index('IDX_alerts_category', ['category'])
export class Alert {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'health_center_id', type: 'uuid' }) healthCenterId!: string;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'health_center_id' })
  healthCenter!: HealthCenter;
  @Column({ name: 'follow_up_id', type: 'uuid' }) followUpId!: string;
  @ManyToOne(() => FollowUp)
  @JoinColumn({ name: 'follow_up_id' })
  followUp!: FollowUp;
  @Column({ name: 'created_by_id', type: 'uuid' }) createdById!: string;
  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: Agent;
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text' }) description!: string;
  @Column({ type: 'varchar', length: 30, default: AlertStatus.ACTIVE })
  status!: AlertStatus;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
  @Column({ name: 'resolved_by_id', type: 'uuid', nullable: true })
  resolvedById!: string | null;
  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy!: Agent | null;
  @Column({ name: 'resolved_by_user_id', type: 'uuid', nullable: true })
  resolvedByUserId!: string | null;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'resolved_by_user_id' })
  resolvedByUser!: User | null;
  @Column({
    name: 'ticket_number',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  ticketNumber!: string | null;
  @Column({ type: 'varchar', length: 20, default: AlertSeverity.HIGH })
  severity!: AlertSeverity;
  @Column({ type: 'varchar', length: 50, default: AlertCategory.GENERAL })
  category!: AlertCategory;
  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary!: string | null;
  @Column({ name: 'under_review', type: 'boolean', default: false })
  underReview!: boolean;
  @Column({ name: 'derived_to', type: 'varchar', length: 50, nullable: true })
  derivedTo!: string | null;
  @Column({ name: 'derivation_notes', type: 'text', nullable: true })
  derivationNotes!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
