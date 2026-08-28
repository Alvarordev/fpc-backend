import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import {
  PatientDocument,
  PatientDocumentStatus,
  PatientDocumentType,
} from '../../../database/entities/patient-document.entity';
import { PatientDiagnosis } from '../../../database/entities/patient-diagnosis.entity';
import { PatientTreatment } from '../../../database/entities/patient-treatment.entity';
import { User } from '../../../database/entities/user.entity';
import { UserRole } from '../../../database/entities/user-role.enum';
import { InMemoryPatientDocumentStorage } from '../../../integrations/storage/patient-document-storage';
import { PatientsService } from '../patients.service';
import { CreatePatientDocumentDto } from './dto/create-patient-document.dto';
import { ListPatientDocumentsDto } from './dto/list-patient-documents.dto';
import { PatientDocumentsService } from './patient-documents.service';

describe('PatientDocumentsService', () => {
  const repositoryCreateMock = jest.fn();
  const repositorySaveMock = jest.fn();
  const repositoryDeleteMock = jest.fn();
  const transactionRepositoryUpdateMock = jest.fn();
  const patientsAssertPatientRoleMock = jest.fn();
  const repository = {
    create: repositoryCreateMock,
    save: repositorySaveMock,
    update: jest.fn(),
    delete: repositoryDeleteMock,
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
  } as unknown as Repository<PatientDocument>;
  const diagnoses = {
    existsBy: jest.fn(),
  } as unknown as Repository<PatientDiagnosis>;
  const treatments = {
    existsBy: jest.fn(),
  } as unknown as Repository<PatientTreatment>;
  const patients = {
    assertPatientRole: patientsAssertPatientRoleMock,
  } as unknown as PatientsService;
  const transactionRepository = {
    update: transactionRepositoryUpdateMock,
    findOneByOrFail: jest.fn(),
  } as unknown as Repository<PatientDocument>;
  const dataSource = {
    transaction: jest.fn(),
  } as unknown as DataSource;
  const configService = {
    get: jest.fn().mockReturnValue(10_485_760),
  } as unknown as ConfigService;
  let storage: InMemoryPatientDocumentStorage;
  let service: PatientDocumentsService;

  const user = { id: 'user-id', role: UserRole.AGENT } as User;
  const pdf = {
    originalname: 'informe.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nreport'),
    size: 15,
  } as Express.Multer.File;

  beforeEach(() => {
    jest.resetAllMocks();
    storage = new InMemoryPatientDocumentStorage();
    patientsAssertPatientRoleMock.mockResolvedValue({});
    (diagnoses.existsBy as jest.Mock).mockResolvedValue(true);
    (treatments.existsBy as jest.Mock).mockResolvedValue(true);
    repositoryCreateMock.mockImplementation(
      (value: Partial<PatientDocument>) => value,
    );
    repositorySaveMock.mockImplementation((value: PatientDocument) => ({
      createdAt: new Date('2026-08-27T12:00:00.000Z'),
      ...value,
    }));
    repositoryDeleteMock.mockResolvedValue({ affected: 1 });
    transactionRepositoryUpdateMock.mockResolvedValue({
      affected: 1,
    });
    (transactionRepository.findOneByOrFail as jest.Mock).mockImplementation(
      ({ id }: { id: string }) => ({
        id,
        patientId: 'patient-id',
        documentType: PatientDocumentType.MEDICAL_REPORT,
        diagnosisId: 'diagnosis-id',
        treatmentId: null,
        description: null,
        originalFileName: 'informe.pdf',
        mediaType: 'application/pdf',
        sizeBytes: pdf.buffer.length,
        sha256: 'a'.repeat(64),
        storageKey: `patient-documents/${id}`,
        status: PatientDocumentStatus.ACTIVE,
        uploadedById: 'user-id',
        createdAt: new Date('2026-08-27T12:00:00.000Z'),
        archivedAt: null,
        archivedById: null,
      }),
    );
    (dataSource.transaction as jest.Mock).mockImplementation(
      (callback: (manager: unknown) => unknown) =>
        callback({
          getRepository: () => transactionRepository,
        }),
    );
    service = new PatientDocumentsService(
      repository,
      diagnoses,
      treatments,
      patients,
      dataSource,
      storage,
      configService,
    );
  });

  it('stores a report with the authenticated uploader and diagnosis', async () => {
    const input: CreatePatientDocumentDto = {
      documentType: PatientDocumentType.MEDICAL_REPORT,
      diagnosisId: 'diagnosis-id',
    };

    const document = await service.create('patient-id', input, pdf, user);

    expect(document.status).toBe(PatientDocumentStatus.ACTIVE);
    expect(repositoryCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-id',
        diagnosisId: 'diagnosis-id',
        treatmentId: null,
        uploadedById: 'user-id',
        status: PatientDocumentStatus.PENDING,
      }),
    );
    expect(storage.has(document.storageKey)).toBe(true);
    expect(transactionRepositoryUpdateMock).toHaveBeenCalledWith(
      { id: document.id, status: PatientDocumentStatus.PENDING },
      { status: PatientDocumentStatus.ACTIVE },
    );
  });

  it('allows a patient-level document only with a description', async () => {
    const input: CreatePatientDocumentDto = {
      documentType: PatientDocumentType.OTHER,
    };

    await expect(
      service.create('patient-id', input, pdf, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repositorySaveMock).not.toHaveBeenCalled();
  });

  it('rejects an association that belongs to another patient', async () => {
    (diagnoses.existsBy as jest.Mock).mockResolvedValue(false);

    await expect(
      service.create(
        'patient-id',
        {
          documentType: PatientDocumentType.MEDICAL_REPORT,
          diagnosisId: 'other-diagnosis-id',
        },
        pdf,
        user,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorySaveMock).not.toHaveBeenCalled();
  });

  it('does not allow volunteers to access documents', async () => {
    const volunteer = { id: 'volunteer-id', role: UserRole.VOLUNTEER } as User;

    await expect(
      service.findAll('patient-id', new ListPatientDocumentsDto(), volunteer),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(patientsAssertPatientRoleMock).not.toHaveBeenCalled();
  });

  it('does not serve archived documents', async () => {
    (repository.findOne as jest.Mock).mockResolvedValue({
      id: 'document-id',
      patientId: 'patient-id',
      status: PatientDocumentStatus.ARCHIVED,
      storageKey: 'patient-documents/document-id',
    });

    await expect(
      service.getContent('patient-id', 'document-id', user),
    ).rejects.toBeInstanceOf(GoneException);
    expect(storage.has('patient-documents/document-id')).toBe(false);
  });
});
