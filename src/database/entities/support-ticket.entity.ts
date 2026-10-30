import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SupportTicketAttachment } from './support-ticket-attachment.entity';
import { SupportTicketMessage } from './support-ticket-message.entity';
import { User } from './user.entity';

export enum SupportTicketType {
  CHANGE_REQUEST = 'CHANGE_REQUEST',
  NEW_FEATURE = 'NEW_FEATURE',
  VISUAL_BUG = 'VISUAL_BUG',
  FUNCTIONAL_BUG = 'FUNCTIONAL_BUG',
  BLOCKING_BUG = 'BLOCKING_BUG',
  QUESTION = 'QUESTION',
}

export enum SupportTicketStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  NEEDS_MEETING = 'NEEDS_MEETING',
  COMPLETED = 'COMPLETED',
  DISMISSED = 'DISMISSED',
}

@Entity('support_tickets')
@Check(
  `"type" IN ('CHANGE_REQUEST','NEW_FEATURE','VISUAL_BUG','FUNCTIONAL_BUG','BLOCKING_BUG','QUESTION')`,
)
@Check(
  `"status" IN ('PENDING','IN_REVIEW','NEEDS_MEETING','COMPLETED','DISMISSED')`,
)
@Index('UQ_support_tickets_ticket_number', ['ticketNumber'], { unique: true })
@Index('IDX_support_tickets_created_by_id', ['createdById'])
@Index('IDX_support_tickets_status_created_at', ['status', 'createdAt'])
export class SupportTicket {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'ticket_number', type: 'integer' })
  @Generated('increment')
  ticketNumber!: number;

  @Column({ type: 'varchar', length: 32 })
  type!: SupportTicketType;

  @Column({ type: 'varchar', length: 16, default: SupportTicketStatus.PENDING })
  status!: SupportTicketStatus;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'page_path', type: 'varchar', length: 512, nullable: true })
  pagePath!: string | null;

  /** Last change the reporter should notice (admin message or status change). */
  @Column({ name: 'reporter_activity_at', type: 'timestamptz', nullable: true })
  reporterActivityAt!: Date | null;

  @Column({ name: 'reporter_seen_at', type: 'timestamptz', nullable: true })
  reporterSeenAt!: Date | null;

  /** Last change admins should notice (new ticket or reporter message). */
  @Column({ name: 'admin_activity_at', type: 'timestamptz', nullable: true })
  adminActivityAt!: Date | null;

  @Column({ name: 'admin_seen_at', type: 'timestamptz', nullable: true })
  adminSeenAt!: Date | null;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User;

  @OneToMany(() => SupportTicketAttachment, (attachment) => attachment.ticket)
  attachments!: SupportTicketAttachment[];

  @OneToMany(() => SupportTicketMessage, (message) => message.ticket)
  messages!: SupportTicketMessage[];

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
