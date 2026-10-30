import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities/user-role.enum';
import {
  SupportTicket,
  SupportTicketStatus,
  SupportTicketType,
} from '../../../database/entities/support-ticket.entity';
import { SupportTicketAttachment } from '../../../database/entities/support-ticket-attachment.entity';
import { SupportTicketMessageKind } from '../../../database/entities/support-ticket-message.entity';
import { User } from '../../../database/entities/user.entity';

export class SupportTicketAttachmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() originalFileName!: string;
  @ApiProperty() mediaType!: string;
  @ApiProperty() sizeBytes!: number;
}

export class SupportTicketUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
}

export class SupportTicketMessageResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: SupportTicketMessageKind })
  kind!: SupportTicketMessageKind;
  @ApiProperty({ nullable: true }) body!: string | null;
  @ApiProperty({ enum: SupportTicketStatus, nullable: true })
  status!: SupportTicketStatus | null;
  @ApiProperty({ type: SupportTicketUserDto }) author!: SupportTicketUserDto;
  @ApiProperty({ type: [SupportTicketAttachmentResponseDto] })
  attachments!: SupportTicketAttachmentResponseDto[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class SupportTicketResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() ticketNumber!: number;
  @ApiProperty({ enum: SupportTicketType }) type!: SupportTicketType;
  @ApiProperty({ enum: SupportTicketStatus }) status!: SupportTicketStatus;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ nullable: true }) pagePath!: string | null;
  @ApiProperty({ type: SupportTicketUserDto }) createdBy!: SupportTicketUserDto;
  @ApiProperty({
    type: [SupportTicketAttachmentResponseDto],
    description: 'Images sent with the ticket itself',
  })
  attachments!: SupportTicketAttachmentResponseDto[];
  @ApiProperty({ type: [SupportTicketMessageResponseDto] })
  messages!: SupportTicketMessageResponseDto[];
  @ApiProperty({
    description: 'There are changes the current user has not seen yet',
  })
  hasUpdates!: boolean;
  @ApiProperty({ format: 'date-time', nullable: true })
  resolvedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;

  static from(ticket: SupportTicket, viewer: User): SupportTicketResponseDto {
    const all = ticket.attachments ?? [];
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      type: ticket.type,
      status: ticket.status,
      title: ticket.title,
      description: ticket.description,
      pagePath: ticket.pagePath,
      createdBy: toUser(ticket.createdBy),
      attachments: toAttachments(all.filter((a) => a.messageId === null)),
      messages: [...(ticket.messages ?? [])]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((message) => ({
          id: message.id,
          kind: message.kind,
          body: message.body,
          status: message.status as SupportTicketStatus | null,
          author: toUser(message.author),
          attachments: toAttachments(
            all.filter((a) => a.messageId === message.id),
          ),
          createdAt: message.createdAt.toISOString(),
        })),
      hasUpdates: hasUpdatesFor(ticket, viewer),
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }
}

function hasUpdatesFor(ticket: SupportTicket, viewer: User): boolean {
  const unseen = (activity: Date | null, seen: Date | null) =>
    activity !== null && (seen === null || activity > seen);
  const asReporter =
    ticket.createdById === viewer.id &&
    unseen(ticket.reporterActivityAt, ticket.reporterSeenAt);
  const asAdmin =
    viewer.role === UserRole.ADMIN &&
    unseen(ticket.adminActivityAt, ticket.adminSeenAt);
  return asReporter || asAdmin;
}

function toUser(user: User): SupportTicketUserDto {
  return { id: user.id, email: user.email, role: user.role };
}

function toAttachments(
  attachments: SupportTicketAttachment[],
): SupportTicketAttachmentResponseDto[] {
  return [...attachments]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((a) => ({
      id: a.id,
      originalFileName: a.originalFileName,
      mediaType: a.mediaType,
      sizeBytes: a.sizeBytes,
    }));
}
