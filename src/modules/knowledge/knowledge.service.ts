import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { extname, basename } from 'node:path';
import JSZip from 'jszip';
import {
  KnowledgeDocument,
  KnowledgeIndexStatus,
  KnowledgeStatus,
} from '../../database/entities/knowledge-document.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { GeminiKnowledgeClient } from '../../integrations/gemini/gemini-knowledge.client';
import {
  CreateKnowledgeDocumentDto,
  KnowledgeDocumentResponseDto,
  ListKnowledgeDocumentsDto,
} from './dto/knowledge.dto';

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly docs: Repository<KnowledgeDocument>,
    private readonly gemini: GeminiKnowledgeClient,
  ) {}

  async list(query: ListKnowledgeDocumentsDto) {
    const qb = this.docs
      .createQueryBuilder('doc')
      .orderBy('doc.created_at', 'DESC')
      .addOrderBy('doc.id', 'DESC')
      .take(query.limit)
      .skip(query.offset);
    if (query.status)
      qb.andWhere('doc.status = :status', { status: query.status });
    if (query.search?.trim())
      qb.andWhere(
        '(doc.title ILIKE :search OR doc.original_name ILIKE :search)',
        { search: `%${query.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    const [docs, total] = await qb.getManyAndCount();
    return {
      data: docs.map((doc) => KnowledgeDocumentResponseDto.from(doc)),
      total,
    };
  }

  async create(
    input: CreateKnowledgeDocumentDto,
    file: Express.Multer.File | undefined,
    user: User,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Selecciona un documento PDF o Word.');
    const extension = extname(file.originalname).toLowerCase();
    let mediaType: string;
    if (
      extension === '.pdf' &&
      file.buffer.subarray(0, 5).toString() === '%PDF-'
    )
      mediaType = 'application/pdf';
    else if (
      extension === '.docx' &&
      file.buffer.subarray(0, 2).toString() === 'PK'
    ) {
      try {
        const zip = await JSZip.loadAsync(file.buffer);
        if (
          !zip.file('word/document.xml') ||
          Object.keys(zip.files).length > 2000
        )
          throw new Error('Invalid Word');
      } catch {
        throw new UnsupportedMediaTypeException(
          'El archivo no es un documento Word válido. Usa .docx.',
        );
      }
      mediaType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else
      throw new UnsupportedMediaTypeException(
        'Usa un archivo PDF o Word (.docx) válido.',
      );
    const originalName = Array.from(basename(file.originalname))
      .map((character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
          ? '_'
          : character,
      )
      .join('')
      .slice(0, 240);
    return this.docs.save(
      this.docs.create({
        ...input,
        version: input.version.trim() || '1',
        originalName,
        mediaType,
        size: file.size,
        content: file.buffer,
        status: KnowledgeStatus.DRAFT,
        indexStatus: KnowledgeIndexStatus.PENDING,
        uploadedBy: user.id,
        updatedBy: user.id,
        publishedAt: null,
        indexError: null,
        remoteName: null,
        operationName: null,
        storeName: null,
      }),
    );
  }

  async get(id: string, content = false) {
    const qb = this.docs
      .createQueryBuilder('doc')
      .where('doc.id = :id', { id });
    if (content) qb.addSelect('doc.content');
    const doc = await qb.getOne();
    if (!doc) throw new NotFoundException('No se encontró el documento.');
    return doc;
  }

  async content(id: string, user: User) {
    const doc = await this.get(id, true);
    if (
      user.role === UserRole.AGENT &&
      doc.status !== KnowledgeStatus.PUBLISHED
    )
      throw new ForbiddenException(
        'Este documento ya no está publicado. Consulta la biblioteca vigente.',
      );
    return doc;
  }

  async publish(id: string, user: User) {
    return this.docs.manager.transaction(async (manager) => {
      const repo = manager.getRepository(KnowledgeDocument);
      const doc = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!doc) throw new NotFoundException('No se encontró el documento.');
      if (doc.indexStatus !== KnowledgeIndexStatus.READY)
        throw new ConflictException(
          'El documento debe estar listo antes de publicarlo.',
        );
      doc.status = KnowledgeStatus.PUBLISHED;
      doc.publishedAt = new Date();
      doc.updatedBy = user.id;
      return repo.save(doc);
    });
  }

  async archive(id: string, user: User) {
    await this.get(id);
    await this.docs.update(id, {
      status: KnowledgeStatus.ARCHIVED,
      updatedBy: user.id,
    });
    return this.get(id);
  }

  async retry(id: string, user: User) {
    const doc = await this.get(id);
    if (doc.indexStatus !== KnowledgeIndexStatus.FAILED)
      throw new ConflictException(
        'Solo se pueden reintentar los documentos que no se prepararon correctamente.',
      );
    await this.docs.update(id, {
      indexStatus: KnowledgeIndexStatus.PENDING,
      indexError: null,
      operationName: null,
      indexStartedAt: null,
      updatedBy: user.id,
    });
    return this.get(id);
  }

  async remove(id: string) {
    await this.docs.manager.transaction(async (manager) => {
      const repo = manager.getRepository(KnowledgeDocument);
      const doc = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!doc) throw new NotFoundException('No se encontró el documento.');
      if (doc.status === KnowledgeStatus.PUBLISHED)
        throw new ConflictException('Retira el documento antes de eliminarlo.');
      if (
        [
          KnowledgeIndexStatus.PENDING,
          KnowledgeIndexStatus.PROCESSING,
        ].includes(doc.indexStatus)
      )
        throw new ConflictException(
          'Espera a que termine la preparación antes de eliminar el documento.',
        );
      if (doc.remoteName) {
        try {
          await this.gemini.remove(doc.remoteName);
        } catch {
          throw new ServiceUnavailableException(
            'No se pudo eliminar el índice del documento. Intenta de nuevo.',
          );
        }
      }
      await repo.delete(id);
    });
  }

  async status() {
    return {
      publishedCount: await this.docs.countBy({
        status: KnowledgeStatus.PUBLISHED,
        indexStatus: KnowledgeIndexStatus.READY,
      }),
    };
  }
}
