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
@Entity('alerts')
@Check(`"status" IN ('ACTIVE','RESOLVED')`)
@Index('IDX_alerts_health_center_id', ['healthCenterId'])
@Index('IDX_alerts_follow_up_id', ['followUpId'])
@Index('IDX_alerts_created_by_id', ['createdById'])
@Index('IDX_alerts_resolved_by_id', ['resolvedById'])
@Index('IDX_alerts_resolved_by_user_id', ['resolvedByUserId'])
@Index('IDX_alerts_status', ['status'])
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
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
