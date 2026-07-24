import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Agent } from './agent.entity';
import { HealthCenter } from './health-center.entity';
import { Interaction } from './interaction.entity';
export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
}
@Entity('alerts')
@Check(`"status" IN ('ACTIVE','RESOLVED')`)
export class Alert {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'health_center_id', type: 'uuid' }) healthCenterId!: string;
  @ManyToOne(() => HealthCenter)
  @JoinColumn({ name: 'health_center_id' })
  healthCenter!: HealthCenter;
  @Column({ name: 'interaction_id', type: 'uuid' }) interactionId!: string;
  @ManyToOne(() => Interaction)
  @JoinColumn({ name: 'interaction_id' })
  interaction!: Interaction;
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
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
