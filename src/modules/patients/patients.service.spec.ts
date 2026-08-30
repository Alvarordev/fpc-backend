import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { PatientHealthPhase } from '../../database/entities/patient-health-phase.enum';
import { PatientHealthSubcategory } from '../../database/entities/patient-health-subcategory.enum';
import { PatientDetails } from '../../database/entities/patient-details.entity';
import { PatientHealthPhaseHistory } from '../../database/entities/patient-health-phase-history.entity';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { PatientRole } from '../../database/entities/patient-role.enum';
import { PatientStatus } from '../../database/entities/patient-status.enum';
import { Patient } from '../../database/entities/patient.entity';
import { PatientsService } from './patients.service';

describe('PatientsService.assertPatientRole', () => {
  const patient = {
    id: 'patient-id',
    role: PatientRole.PATIENT,
    status: PatientStatus.ENROLLED,
  } as Patient;
  let findOne: jest.Mock;
  let service: PatientsService;

  beforeEach(() => {
    findOne = jest.fn();
    // assertPatientRole only reads the patients repository. The other
    // constructor dependencies are never reached, so they are stubbed
    // wholesale rather than imported one by one just to be discarded.
    const dependencies = [
      { findOne },
      ...Array.from({ length: 14 }, () => ({})),
    ] as unknown as ConstructorParameters<typeof PatientsService>;
    service = new PatientsService(...dependencies);
  });

  it('returns a patient with the expected role and status', async () => {
    findOne.mockResolvedValue(patient);
    await expect(
      service.assertPatientRole(
        patient.id,
        PatientRole.PATIENT,
        PatientStatus.ENROLLED,
      ),
    ).resolves.toBe(patient);
  });

  it('rejects a different role', async () => {
    findOne.mockResolvedValue(patient);
    await expect(
      service.assertPatientRole(patient.id, PatientRole.COMPANION),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a different status', async () => {
    findOne.mockResolvedValue(patient);
    await expect(
      service.assertPatientRole(
        patient.id,
        PatientRole.PATIENT,
        PatientStatus.UNENROLLED,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a missing patient', async () => {
    findOne.mockResolvedValue(null);
    await expect(
      service.assertPatientRole(patient.id, PatientRole.PATIENT),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('PatientsService.upsertDetails health phase history', () => {
  it('records a phase change once and does not duplicate the current phase', async () => {
    const details = {
      patientId: 'patient-id',
      healthPhase: PatientHealthPhase.CANCER_DIAGNOSIS,
    } as PatientDetails;
    const detailsRepository = {
      findOne: jest.fn().mockResolvedValue(details),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((value: unknown) => value),
    };
    const historyRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((value: unknown) => value),
    };
    const healthCentersRepository = { findOne: jest.fn() };
    const invalidations = { markDirty: jest.fn().mockResolvedValue(undefined) };
    const transactionManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PatientDetails) return detailsRepository;
        if (entity === PatientHealthPhaseHistory) return historyRepository;
        if (entity === HealthCenter) return healthCentersRepository;
        return { findOne: jest.fn() };
      }),
    };
    const dependencies = [
      { findOne: jest.fn() },
      detailsRepository,
      historyRepository,
      ...Array.from({ length: 12 }, () => ({})),
      {
        getRepository: jest.fn().mockReturnValue(healthCentersRepository),
        transaction: jest.fn((callback: (manager: unknown) => unknown) =>
          callback(transactionManager),
        ),
      },
      invalidations,
      {},
      {},
    ] as unknown as ConstructorParameters<typeof PatientsService>;
    const service = new PatientsService(...dependencies);
    jest.spyOn(service, 'assertPatientRole').mockResolvedValue({} as Patient);

    await service.upsertDetails('patient-id', {
      healthPhase: PatientHealthPhase.ANNUAL_CHECKUP,
    });

    expect(historyRepository.save).toHaveBeenCalledWith({
      patientId: 'patient-id',
      healthPhase: PatientHealthPhase.ANNUAL_CHECKUP,
    });

    historyRepository.save.mockClear();
    await service.upsertDetails('patient-id', {
      healthPhase: PatientHealthPhase.ANNUAL_CHECKUP,
    });

    expect(historyRepository.save).not.toHaveBeenCalled();
  });
});

describe('PatientsService.upsertDetails health subcategory', () => {
  function createService({
    hasActiveDiagnosis,
    details,
  }: {
    hasActiveDiagnosis: boolean;
    details: Partial<PatientDetails>;
  }) {
    const patientRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'patient-id',
        role: PatientRole.PATIENT,
      }),
    };
    const detailsRepository = {
      findOne: jest.fn().mockResolvedValue({
        patientId: 'patient-id',
        healthPhase: null,
        healthSubcategory: null,
        primaryHealthCenterId: null,
        ...details,
      }),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((value: unknown) => value),
    };
    const historyRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((value: unknown) => value),
    };
    const diagnosisRepository = {
      existsBy: jest.fn().mockResolvedValue(hasActiveDiagnosis),
    };
    const healthCentersRepository = { findOne: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Patient) return patientRepository;
        if (entity === PatientDetails) return detailsRepository;
        if (entity === PatientHealthPhaseHistory) return historyRepository;
        if (entity === PatientDiagnosis) return diagnosisRepository;
        if (entity === HealthCenter) return healthCentersRepository;
        return {};
      }),
    };
    const invalidations = { markDirty: jest.fn().mockResolvedValue(undefined) };
    const dependencies = [
      patientRepository,
      detailsRepository,
      historyRepository,
      ...Array.from({ length: 12 }, () => ({})),
      {
        getRepository: jest.fn().mockReturnValue(healthCentersRepository),
      },
      invalidations,
      {},
      {},
    ] as unknown as ConstructorParameters<typeof PatientsService>;
    const service = new PatientsService(...dependencies);
    jest
      .spyOn(service, 'assertPatientRole')
      .mockResolvedValue(patientRepository as unknown as Patient);

    return {
      service,
      manager,
      detailsRepository,
      diagnosisRepository,
    };
  }

  it('derives the health phase from the selected subcategory', async () => {
    const { service, manager, detailsRepository } = createService({
      hasActiveDiagnosis: true,
      details: {},
    });

    await service.upsertDetails(
      'patient-id',
      { healthSubcategory: PatientHealthSubcategory.ACTIVE_TREATMENT },
      manager as never,
    );

    expect(detailsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        healthPhase: PatientHealthPhase.CANCER_DIAGNOSIS,
        healthSubcategory: PatientHealthSubcategory.ACTIVE_TREATMENT,
      }),
    );
  });

  it('rejects an oncological subcategory without an active diagnosis', async () => {
    const { service, manager, detailsRepository, diagnosisRepository } =
      createService({
        hasActiveDiagnosis: false,
        details: {},
      });

    await expect(
      service.upsertDetails(
        'patient-id',
        { healthSubcategory: PatientHealthSubcategory.UNDER_CONTROLS },
        manager as never,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(diagnosisRepository.existsBy).toHaveBeenCalledWith({
      patientId: 'patient-id',
      isCurrent: true,
    });
    expect(detailsRepository.save).not.toHaveBeenCalled();
  });
});
