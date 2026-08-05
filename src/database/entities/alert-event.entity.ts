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
import { Agent } from './agent.entity';
import { Alert } from './alert.entity';
export enum AlertEventType {
  CREATED = 'CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  DERIVED = 'DERIVED',
  COMMENT = 'COMMENT',
  AI_SUMMARY_GENERATED = 'AI_SUMMARY_GENERATED',
  RESOLVED = 'RESOLVED',
}
@Entity('alert_events')
@Check(
  `"event_type" IN ('CREATED','STATUS_CHANGED','DERIVED','COMMENT','AI_SUMMARY_GENERATED','RESOLVED')`,
)
@Index('IDX_alert_events_alert_id', ['alertId'])
@Index('IDX_alert_events_alert_id_created_at', ['alertId', 'createdAt'])
export class AlertEvent {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'alert_id', type: 'uuid' }) alertId!: string;
  @ManyToOne(() => Alert, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_id' })
  alert!: Alert;
  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId!: string | null;
  @ManyToOne(() => Agent, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent | null;
  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType!: AlertEventType;
  @Column({ type: 'varchar', length: 255 }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
