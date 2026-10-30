import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import {
  SupportTicket,
  SupportTicketStatus,
} from '../../database/entities/support-ticket.entity';
import { SupportTicketAttachment } from '../../database/entities/support-ticket-attachment.entity';
import {
  SupportTicketMessage,
  SupportTicketMessageKind,
} from '../../database/entities/support-ticket-message.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import {
  PATIENT_DOCUMENT_STORAGE,
  type PatientDocumentStorage,
} from '../../integrations/storage/patient-document-storage';
import {
  validatePatientDocumentFile,
  type ValidatedPatientDocumentFile,
} from '../patients/documents/patient-document-file.validation';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateSupportTicketMessageDto } from './dto/create-support-ticket-message.dto';
import { ListSupportTicketsDto } from './dto/list-support-tickets.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';

export const MAX_SUPPORT_TICKET_IMAGES = 6;
export const MAX_SUPPORT_TICKET_IMAGE_BYTES = 10_485_760;

const CLOSED_STATUSES = new Set([
  SupportTicketStatus.COMPLETED,
  SupportTicketStatus.DISMISSED,
]);

const TICKET_RELATIONS = {
  createdBy: true,
  attachments: true,
  messages: { author: true },
} as const;

interface StoredImage {
  id: string;
  key: string;
  metadata: ValidatedPatientDocumentFile;
}

export interface SupportTicketAttachmentContent {
  attachment: SupportTicketAttachment;
  body: Readable;
  contentLength: number;
}

@Injectable()
export class SupportTicketsService {
  private readonly logger = new Logger(SupportTicketsService.name);

  constructor(
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(SupportTicketAttachment)
    private readonly attachments: Repository<SupportTicketAttachment>,
    private readonly dataSource: DataSource,
    @Inject(PATIENT_DOCUMENT_STORAGE)
    private readonly storage: PatientDocumentStorage,
  ) {}

  async create(
    input: CreateSupportTicketDto,
    files: Express.Multer.File[],
    user: User,
  ): Promise<SupportTicket> {
    const ticketId = crypto.randomUUID();
    const images = await this.storeImages(ticketId, files);

    await this.persist(images, async (manager) => {
      await manager.getRepository(SupportTicket).insert({
        id: ticketId,
        type: input.type,
        title: input.title,
        description: input.description,
        pagePath: input.pagePath?.trim() || null,
        createdById: user.id,
        adminActivityAt: new Date(),
      });
      await this.insertAttachments(manager, ticketId, null, images);
    });

    return this.findOne(ticketId, user);
  }

  async findAll(
    query: ListSupportTicketsDto,
    user: User,
  ): Promise<SupportTicket[]> {
    const where: FindOptionsWhere<SupportTicket> = {};
    if (user.role !== UserRole.ADMIN) where.createdById = user.id;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    return this.tickets.find({
      where,
      relations: TICKET_RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<SupportTicket> {
    const ticket = await this.tickets.findOne({
      where: { id },
      relations: TICKET_RELATIONS,
    });
    if (
      !ticket ||
      (user.role !== UserRole.ADMIN && ticket.createdById !== user.id)
    ) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  /** Admin status change; recorded in the thread and flagged to the reporter. */
  async update(
    id: string,
    input: UpdateSupportTicketDto,
    user: User,
  ): Promise<SupportTicket> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can update tickets');
    }
    const ticket = await this.findOne(id, user);
    if (input.status === ticket.status) return ticket;

    await this.dataSource.transaction(async (manager) => {
      await this.changeStatus(manager, ticket, input.status, user);
      await manager
        .getRepository(SupportTicket)
        .update(ticket.id, { reporterActivityAt: new Date() });
    });
    return this.findOne(id, user);
  }

  /**
   * Adds a reply to the thread. A reply from the reporter on a closed ticket
   * reopens it, so follow-ups on the same problem stay in one place.
   */
  async addMessage(
    id: string,
    input: CreateSupportTicketMessageDto,
    files: Express.Multer.File[],
    user: User,
  ): Promise<SupportTicket> {
    const ticket = await this.findOne(id, user);
    const body = input.body?.trim() || null;
    if (!body && files.length === 0) {
      throw new BadRequestException('A message needs text or images');
    }

    const isReporter = ticket.createdById === user.id;
    const messageId = crypto.randomUUID();
    const images = await this.storeImages(ticket.id, files);

    await this.persist(images, async (manager) => {
      await manager.getRepository(SupportTicketMessage).insert({
        id: messageId,
        ticketId: ticket.id,
        kind: SupportTicketMessageKind.COMMENT,
        body,
        authorId: user.id,
      });
      await this.insertAttachments(manager, ticket.id, messageId, images);

      if (isReporter && CLOSED_STATUSES.has(ticket.status)) {
        await this.changeStatus(
          manager,
          ticket,
          SupportTicketStatus.PENDING,
          user,
        );
      }

      const now = new Date();
      await manager
        .getRepository(SupportTicket)
        .update(
          ticket.id,
          isReporter
            ? { adminActivityAt: now, reporterSeenAt: now }
            : { reporterActivityAt: now, adminSeenAt: now },
        );
    });

    return this.findOne(id, user);
  }

  async markSeen(id: string, user: User): Promise<SupportTicket> {
    const ticket = await this.findOne(id, user);
    const now = new Date();
    const changes: Partial<SupportTicket> = {};
    if (ticket.createdById === user.id) changes.reporterSeenAt = now;
    if (user.role === UserRole.ADMIN) changes.adminSeenAt = now;
    await this.tickets.update(ticket.id, changes);
    return this.findOne(id, user);
  }

  async getAttachmentContent(
    ticketId: string,
    attachmentId: string,
    user: User,
  ): Promise<SupportTicketAttachmentContent> {
    await this.findOne(ticketId, user);
    const attachment = await this.attachments.findOneBy({
      id: attachmentId,
      ticketId,
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    try {
      const object = await this.storage.get(attachment.storageKey);
      return {
        attachment,
        body: object.body,
        contentLength: object.contentLength ?? attachment.sizeBytes,
      };
    } catch {
      throw new ServiceUnavailableException('Image is unavailable');
    }
  }

  private async changeStatus(
    manager: EntityManager,
    ticket: SupportTicket,
    status: SupportTicketStatus,
    user: User,
  ): Promise<void> {
    await manager.getRepository(SupportTicket).update(ticket.id, {
      status,
      resolvedAt: CLOSED_STATUSES.has(status) ? new Date() : null,
    });
    await manager.getRepository(SupportTicketMessage).insert({
      ticketId: ticket.id,
      kind: SupportTicketMessageKind.STATUS_CHANGE,
      status,
      authorId: user.id,
    });
  }

  private async storeImages(
    ticketId: string,
    files: Express.Multer.File[],
  ): Promise<StoredImage[]> {
    if (files.length > MAX_SUPPORT_TICKET_IMAGES) {
      throw new BadRequestException(
        `At most ${MAX_SUPPORT_TICKET_IMAGES} images are allowed`,
      );
    }

    const validated = await Promise.all(
      files.map(async (file) => {
        const metadata = await validatePatientDocumentFile(
          file,
          MAX_SUPPORT_TICKET_IMAGE_BYTES,
        );
        if (!metadata.mediaType.startsWith('image/')) {
          throw new UnsupportedMediaTypeException(
            'Only JPG, PNG or WEBP images are allowed',
          );
        }
        const id = crypto.randomUUID();
        return { file, id, key: `support-tickets/${ticketId}/${id}`, metadata };
      }),
    );

    const stored: StoredImage[] = [];
    try {
      for (const { file, id, key, metadata } of validated) {
        await this.storage.put({
          key,
          body: file.buffer,
          contentType: metadata.mediaType,
          contentLength: metadata.sizeBytes,
          sha256: metadata.sha256,
        });
        stored.push({ id, key, metadata });
      }
    } catch {
      await this.deleteObjects(stored.map((image) => image.key));
      throw new ServiceUnavailableException(
        'Image storage is temporarily unavailable',
      );
    }
    return stored;
  }

  /** Runs the DB writes; removes already-uploaded images if they fail. */
  private async persist(
    images: StoredImage[],
    work: (manager: EntityManager) => Promise<void>,
  ): Promise<void> {
    try {
      await this.dataSource.transaction(work);
    } catch (error) {
      await this.deleteObjects(images.map((image) => image.key));
      throw error;
    }
  }

  private async insertAttachments(
    manager: EntityManager,
    ticketId: string,
    messageId: string | null,
    images: StoredImage[],
  ): Promise<void> {
    if (images.length === 0) return;
    await manager.getRepository(SupportTicketAttachment).insert(
      images.map(({ id, key, metadata }) => ({
        id,
        ticketId,
        messageId,
        originalFileName: metadata.originalFileName,
        mediaType: metadata.mediaType,
        sizeBytes: metadata.sizeBytes,
        storageKey: key,
      })),
    );
  }

  private async deleteObjects(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch {
        this.logger.error(`Could not clean up support ticket image ${key}`);
      }
    }
  }
}
