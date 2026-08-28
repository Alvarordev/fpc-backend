import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  In,
  LessThan,
  Repository,
} from 'typeorm';
import {
  PatientDocument,
  PatientDocumentStatus,
  PatientDocumentType,
} from '../../../database/entities/patient-document.entity';
import { PatientDiagnosis } from '../../../database/entities/patient-diagnosis.entity';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientTreatment } from '../../../database/entities/patient-treatment.entity';
import { User } from '../../../database/entities/user.entity';
import {
  PATIENT_DOCUMENT_STORAGE,
  PatientDocumentStorageNotFoundError,
} from '../../../integrations/storage/patient-document-storage';
import type { PatientDocumentStorage } from '../../../integrations/storage/patient-document-storage';
import { PatientsService } from '../patients.service';
import { CreatePatientDocumentDto } from './dto/create-patient-document.dto';
import { ListPatientDocumentsDto } from './dto/list-patient-documents.dto';
import {
  PatientDocumentListResponseDto,
  PatientDocumentResponseDto,
} from './dto/patient-document-response.dto';
import { validatePatientDocumentFile } from './patient-document-file.validation';
import { Readable } from 'node:stream';

const DOCUMENT_ROLES = new Set(['ADMIN', 'FOUNDATION', 'AGENT']);
const PENDING_DOCUMENT_TTL_MS = 60 * 60 * 1000;

export interface PatientDocumentContent {
  document: PatientDocument;
  body: Readable;
  contentLength: number;
}

@Injectable()
export class PatientDocumentsService {
  private readonly logger = new Logger(PatientDocumentsService.name);
  private readonly maxFileBytes: number;

  constructor(
    @InjectRepository(PatientDocument)
    private readonly repository: Repository<PatientDocument>,
    @InjectRepository(PatientDiagnosis)
    private readonly diagnoses: Repository<PatientDiagnosis>,
    @InjectRepository(PatientTreatment)
    private readonly treatments: Repository<PatientTreatment>,
    private readonly patients: PatientsService,
    private readonly dataSource: DataSource,
    @Inject(PATIENT_DOCUMENT_STORAGE)
    private readonly storage: PatientDocumentStorage,
    configService: ConfigService,
  ) {
    this.maxFileBytes = configService.get<number>(
      'PATIENT_DOCUMENT_MAX_BYTES',
      10_485_760,
    );
  }

  async create(
    patientId: string,
    input: CreatePatientDocumentDto,
    file: Express.Multer.File | undefined,
    user: User,
  ): Promise<PatientDocument> {
    this.assertCanManage(user);
    await this.patients.assertPatientRole(patientId, PatientRole.PATIENT);
    await this.validateAssociation(patientId, input);

    const fileMetadata = await validatePatientDocumentFile(
      file,
      this.maxFileBytes,
    );
    const documentId = crypto.randomUUID();
    const storageKey = `patient-documents/${documentId}`;
    const description = input.description?.trim() || null;

    const pending = this.repository.create({
      id: documentId,
      patientId,
      documentType: input.documentType,
      diagnosisId: input.diagnosisId ?? null,
      treatmentId: input.treatmentId ?? null,
      description,
      originalFileName: fileMetadata.originalFileName,
      mediaType: fileMetadata.mediaType,
      sizeBytes: fileMetadata.sizeBytes,
      sha256: fileMetadata.sha256,
      storageKey,
      status: PatientDocumentStatus.PENDING,
      uploadedById: user.id,
      archivedAt: null,
      archivedById: null,
    });

    await this.repository.save(pending);

    try {
      await this.storage.put({
        key: storageKey,
        body: file!.buffer,
        contentType: fileMetadata.mediaType,
        contentLength: fileMetadata.sizeBytes,
        sha256: fileMetadata.sha256,
      });
    } catch {
      await this.cleanupFailedUpload(documentId, storageKey);
      throw new ServiceUnavailableException(
        'Document storage is temporarily unavailable',
      );
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(PatientDocument);
        const result = await repository.update(
          { id: documentId, status: PatientDocumentStatus.PENDING },
          { status: PatientDocumentStatus.ACTIVE },
        );
        if (result.affected !== 1) {
          throw new ConflictException('Document upload could not be finalized');
        }

        return repository.findOneByOrFail({ id: documentId });
      });
    } catch (error) {
      await this.cleanupFailedUpload(documentId, storageKey);
      throw error;
    }
  }

  async findAll(
    patientId: string,
    query: ListPatientDocumentsDto,
    user: User,
  ): Promise<PatientDocumentListResponseDto> {
    this.assertCanManage(user);
    await this.patients.assertPatientRole(patientId, PatientRole.PATIENT);

    if (query.diagnosisId && query.treatmentId) {
      throw new BadRequestException(
        'diagnosisId and treatmentId cannot be combined',
      );
    }

    const where: FindOptionsWhere<PatientDocument> = {
      patientId,
      status: query.includeArchived
        ? In([PatientDocumentStatus.ACTIVE, PatientDocumentStatus.ARCHIVED])
        : PatientDocumentStatus.ACTIVE,
    };
    if (query.documentType) where.documentType = query.documentType;
    if (query.diagnosisId) where.diagnosisId = query.diagnosisId;
    if (query.treatmentId) where.treatmentId = query.treatmentId;

    const [documents, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: query.offset,
      take: query.limit,
    });

    return {
      data: documents.map((document) =>
        PatientDocumentResponseDto.from(document),
      ),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getContent(
    patientId: string,
    documentId: string,
    user: User,
  ): Promise<PatientDocumentContent> {
    this.assertCanManage(user);
    await this.patients.assertPatientRole(patientId, PatientRole.PATIENT);

    const document = await this.findByPatientAndId(patientId, documentId);
    if (!document || document.status === PatientDocumentStatus.PENDING) {
      throw new NotFoundException('Document not found');
    }
    if (document.status === PatientDocumentStatus.ARCHIVED) {
      throw new GoneException('Document has been archived');
    }

    try {
      const object = await this.storage.get(document.storageKey);
      return {
        document,
        body: object.body,
        contentLength: object.contentLength ?? document.sizeBytes,
      };
    } catch (error) {
      if (error instanceof PatientDocumentStorageNotFoundError) {
        throw new ServiceUnavailableException(
          'Document content is unavailable',
        );
      }
      throw new ServiceUnavailableException(
        'Document storage is temporarily unavailable',
      );
    }
  }

  async archive(
    patientId: string,
    documentId: string,
    user: User,
  ): Promise<PatientDocument> {
    this.assertCanManage(user);
    await this.patients.assertPatientRole(patientId, PatientRole.PATIENT);

    const document = await this.findByPatientAndId(patientId, documentId);
    if (!document || document.status === PatientDocumentStatus.PENDING) {
      throw new NotFoundException('Document not found');
    }
    if (document.status === PatientDocumentStatus.ARCHIVED) return document;

    document.status = PatientDocumentStatus.ARCHIVED;
    document.archivedAt = new Date();
    document.archivedById = user.id;
    return this.repository.save(document);
  }

  @Cron('0 * * * *')
  async cleanupPendingDocuments(): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_DOCUMENT_TTL_MS);
    const pendingDocuments = await this.repository.find({
      where: {
        status: PatientDocumentStatus.PENDING,
        createdAt: LessThan(cutoff),
      },
      order: { createdAt: 'ASC' },
      take: 100,
    });

    for (const document of pendingDocuments) {
      try {
        await this.storage.delete(document.storageKey);
        await this.repository.delete({
          id: document.id,
          status: PatientDocumentStatus.PENDING,
        });
      } catch {
        this.logger.error(
          `Could not clean up pending patient document ${document.id}`,
        );
      }
    }
  }

  private async validateAssociation(
    patientId: string,
    input: CreatePatientDocumentDto,
  ): Promise<void> {
    if (input.diagnosisId && input.treatmentId) {
      throw new BadRequestException(
        'A document can only have one clinical association',
      );
    }

    if (input.documentType === PatientDocumentType.MEDICAL_REPORT) {
      if (!input.diagnosisId || input.treatmentId) {
        throw new BadRequestException(
          'Medical reports require a diagnosis association',
        );
      }
      if (
        !(await this.diagnoses.existsBy({
          id: input.diagnosisId,
          patientId,
        }))
      ) {
        throw new NotFoundException('Diagnosis not found');
      }
      return;
    }

    if (input.documentType === PatientDocumentType.PRESCRIPTION) {
      if (!input.treatmentId || input.diagnosisId) {
        throw new BadRequestException(
          'Prescriptions require a treatment association',
        );
      }
      if (
        !(await this.treatments.existsBy({
          id: input.treatmentId,
          patientId,
        }))
      ) {
        throw new NotFoundException('Treatment not found');
      }
      return;
    }

    if (input.diagnosisId || input.treatmentId) {
      throw new BadRequestException(
        'Other documents cannot have a clinical association',
      );
    }
    if (!input.description?.trim()) {
      throw new BadRequestException('Other documents require a description');
    }
  }

  private async findByPatientAndId(
    patientId: string,
    documentId: string,
  ): Promise<PatientDocument | null> {
    return this.repository.findOne({ where: { id: documentId, patientId } });
  }

  private assertCanManage(user: User): void {
    if (!DOCUMENT_ROLES.has(user.role)) {
      throw new ForbiddenException('You cannot access patient documents');
    }
  }

  private async cleanupFailedUpload(
    documentId: string,
    storageKey: string,
  ): Promise<void> {
    try {
      await this.storage.delete(storageKey);
      await this.repository.delete({
        id: documentId,
        status: PatientDocumentStatus.PENDING,
      });
    } catch {
      this.logger.error(
        `Could not clean up failed patient document ${documentId}`,
      );
    }
  }
}
