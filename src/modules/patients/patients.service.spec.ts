import { ConflictException, NotFoundException } from '@nestjs/common';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { PatientHealthPhase } from '../../database/entities/patient-health-phase.enum';
import { PatientDetails } from '../../database/entities/patient-details.entity';
import { PatientHealthPhaseHistory } from '../../database/entities/patient-health-phase-history.entity';
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
