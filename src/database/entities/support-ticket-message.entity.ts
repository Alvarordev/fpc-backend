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
} from 'typeorm';
import { SupportTicket } from './support-ticket.entity';
import { SupportTicketAttachment } from './support-ticket-attachment.entity';
import { User } from './user.entity';

export enum SupportTicketMessageKind {
  COMMENT = 'COMMENT',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

@Entity('support_ticket_messages')
@Check(`"kind" IN ('COMMENT','STATUS_CHANGE')`)
@Index('IDX_support_ticket_messages_ticket_created_at', [
  'ticketId',
  'createdAt',
])
export class SupportTicketMessage {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => SupportTicket, (ticket) => ticket.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: SupportTicket;

  @Column({ type: 'varchar', length: 16 })
  kind!: SupportTicketMessageKind;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  /** New status, for STATUS_CHANGE entries. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  status!: string | null;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @OneToMany(() => SupportTicketAttachment, (attachment) => attachment.message)
  attachments!: SupportTicketAttachment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
