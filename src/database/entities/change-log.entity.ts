import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { AuditContextKind } from '../../shared/audit/audit-context';

export enum ChangeLogOperation {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * One row per changed field of a patient record. Written only by the
 * `audit_row_change` trigger and by HistoryVersioningService; never by hand.
 * INSERT/DELETE rows carry the whole record in new_value/old_value.
 */
@Entity('change_log')
@Index('IDX_change_log_patient_changed', ['patientId', 'changedAt'])
@Index('IDX_change_log_entity', ['entityType', 'entityId'])
@Index('IDX_change_log_follow_up', ['followUpId'])
@Index('IDX_change_log_change_set', ['changeSetId'])
export class ChangeLog {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'change_set_id', type: 'uuid' }) changeSetId!: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 80 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' }) entityId!: string;

  @Column({ type: 'varchar', length: 10 }) operation!: ChangeLogOperation;

  @Column({ type: 'varchar', length: 80, nullable: true })
  field!: string | null;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue!: unknown;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue!: unknown;

  @Column({ type: 'varchar', length: 20 }) context!: AuditContextKind;

  @Column({ name: 'follow_up_id', type: 'uuid', nullable: true })
  followUpId!: string | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'changed_at', type: 'timestamptz' }) changedAt!: Date;
}
