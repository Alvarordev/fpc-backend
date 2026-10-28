import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Agent } from './agent.entity';
import { HealthCenter } from './health-center.entity';
import { FollowUp } from './follow-up.entity';
import { User } from './user.entity';
import { AlertReport } from './alert-report.entity';
import { CatalogItem } from './catalog-item.entity';
import { Foundation } from './foundation.entity';
export enum AlertStatus {
  REPORTED = 'REPORTED',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
}
export enum AlertSeverity {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}
/** Seed codes for the alert_category catalog. New options live in catalog_items. */
export enum AlertCategory {
  GENERAL = 'GENERAL',
  MEDICATION_SHORTAGE = 'MEDICATION_SHORTAGE',
  APPOINTMENT_DELAY = 'APPOINTMENT_DELAY',
  INSURANCE_COVERAGE = 'INSURANCE_COVERAGE',
  TRANSPORT = 'TRANSPORT',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  PSYCHOSOCIAL = 'PSYCHOSOCIAL',
}
@Entity('alerts')
@Check(`"status" IN ('REPORTED','IN_REVIEW','RESOLVED')`)
@Check(`"severity" IN ('HIGH','MEDIUM','LOW')`)
@Index('IDX_alerts_health_center_id', ['healthCenterId'])
@Index('IDX_alerts_follow_up_id', ['followUpId'])
@Index('IDX_alerts_created_by_id', ['createdById'])
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
  @Column({ type: 'varchar', length: 30, default: AlertStatus.REPORTED })
  status!: AlertStatus;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
  @Column({ name: 'resolved_by_user_id', type: 'uuid', nullable: true })
  resolvedByUserId!: string | null;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'resolved_by_user_id' })
  resolvedByUser!: User | null;
  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes!: string | null;
  @Column({
    name: 'ticket_number',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  ticketNumber!: string | null;
  @Column({ type: 'varchar', length: 20, default: AlertSeverity.HIGH })
  severity!: AlertSeverity;
  @Column({ type: 'varchar', length: 100, default: AlertCategory.GENERAL })
  category!: string;
  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary!: string | null;
  @Column({ name: 'derived_to', type: 'varchar', length: 100, nullable: true })
  derivedTo!: string | null;
  @Column({ name: 'derivation_notes', type: 'text', nullable: true })
  derivationNotes!: string | null;
  @Column({ name: 'derived_at', type: 'timestamptz', nullable: true })
  derivedAt!: Date | null;
  @OneToMany(() => AlertReport, (report) => report.alert)
  reports!: AlertReport[];
  reportsCount?: number;
  categoryItem?: CatalogItem | null;
  derivedToItem?: CatalogItem | null;
  resolverAgent?: Agent | null;
  resolverFoundation?: Foundation | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
