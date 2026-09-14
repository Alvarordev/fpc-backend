import { DataSource, EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { PatientDiagnosis } from '../../../database/entities/patient-diagnosis.entity';
import { PatientDiagnosisMode } from '../../../database/entities/patient-diagnosis-mode.enum';
import { PatientDiagnosticStatusEvent } from '../../../database/entities/patient-diagnostic-status-event.entity';
import { PatientDiagnosticStatus } from '../../../database/entities/patient-diagnostic-status.enum';
import { PatientHealthPhase } from '../../../database/entities/patient-health-phase.enum';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientHealthSubcategory } from '../../../database/entities/patient-health-subcategory.enum';
import { Patient } from '../../../database/entities/patient.entity';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { PatientDiagnosesService } from '../clinical/diagnoses/patient-diagnoses.service';
import { PatientsService } from '../patients.service';
import { PatientDiagnosticStatusesService } from './patient-diagnostic-statuses.service';

describe('PatientDiagnosticStatusesService', () => {
  it('records one SEARCHING event for an enrollment follow-up', async () => {
    const event = {
      id: 'event-id',
      patientId: 'patient-id',
      followUpId: 'follow-up-id',
      status: PatientDiagnosticStatus.SEARCHING,
      occurredAt: new Date('2026-08-01T00:00:00.000Z'),
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    } as PatientDiagnosticStatusEvent;
    const events = {
      findOne: jest.fn().mockResolvedValueOnce(null),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(event),
    };
    const followUps = { existsBy: jest.fn().mockResolvedValue(true) };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === FollowUp ? followUps : events,
      ),
    } as unknown as EntityManager;
    const service = new PatientDiagnosticStatusesService(
      events as unknown as Repository<PatientDiagnosticStatusEvent>,
      {} as DataSource,
      {} as PatientsService,
      {} as PatientDiagnosesService,
      {
        markDirty: jest.fn().mockResolvedValue(undefined),
      } as unknown as PatientSummaryInvalidationService,
    );

    const created = await service.recordSearching(
      'patient-id',
      'follow-up-id',
      manager,
      event.occurredAt,
    );

    expect(created).toBe(event);
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-id',
        followUpId: 'follow-up-id',
        status: PatientDiagnosticStatus.SEARCHING,
      }),
    );
  });

  it('transitions SEARCHING to RULED_OUT without creating a formal diagnosis', async () => {
    const current = {
      status: PatientDiagnosticStatus.SEARCHING,
      patientId: 'patient-id',
    } as PatientDiagnosticStatusEvent;
    const saved = {
      id: 'event-ruled-out',
      patientId: 'patient-id',
      status: PatientDiagnosticStatus.RULED_OUT,
      occurredAt: new Date('2026-08-02T00:00:00.000Z'),
      createdAt: new Date('2026-08-02T00:00:00.000Z'),
    } as PatientDiagnosticStatusEvent;
    const patientQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'patient-id',
        role: PatientRole.PATIENT,
      }),
    };
    const events = {
      findOne: jest.fn().mockResolvedValue(current),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(saved),
    };
    const followUps = { existsBy: jest.fn().mockResolvedValue(true) };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Patient)
          return { createQueryBuilder: jest.fn(() => patientQuery) };
        if (entity === FollowUp) return followUps;
        return events;
      }),
    } as unknown as EntityManager;
    const patients = { upsertDetails: jest.fn() };
    const service = new PatientDiagnosticStatusesService(
      events as unknown as Repository<PatientDiagnosticStatusEvent>,
      {
        transaction: jest.fn((callback: (value: EntityManager) => unknown) =>
          callback(manager),
        ),
      } as unknown as DataSource,
      patients as unknown as PatientsService,
      { create: jest.fn() } as unknown as PatientDiagnosesService,
      {
        markDirty: jest.fn().mockResolvedValue(undefined),
      } as unknown as PatientSummaryInvalidationService,
    );

    const result = await service.transition('patient-id', {
      status: PatientDiagnosticStatus.RULED_OUT,
      followUpId: 'follow-up-id',
    });

    expect(result).toBe(saved);
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-id',
        followUpId: 'follow-up-id',
        status: PatientDiagnosticStatus.RULED_OUT,
        diagnosisId: null,
      }),
    );
    expect(patients.upsertDetails).toHaveBeenCalledWith(
      'patient-id',
      { healthSubcategory: PatientHealthSubcategory.CANCER_RULED_OUT },
      manager,
    );
  });

  it('transitions SEARCHING to CONFIRMED inside the transaction', async () => {
    const current = {
      status: PatientDiagnosticStatus.SEARCHING,
      patientId: 'patient-id',
      diagnosisId: null,
    } as PatientDiagnosticStatusEvent;
    const saved = {
      id: 'event-confirmed',
      patientId: 'patient-id',
      status: PatientDiagnosticStatus.CONFIRMED,
      diagnosisId: 'diagnosis-id',
    } as PatientDiagnosticStatusEvent;
    const patientQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'patient-id',
        role: PatientRole.PATIENT,
      }),
    };
    const events = {
      findOne: jest.fn().mockResolvedValue(current),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(saved),
    };
    const diagnosesRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const followUps = { existsBy: jest.fn().mockResolvedValue(true) };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Patient)
          return { createQueryBuilder: jest.fn(() => patientQuery) };
        if (entity === FollowUp) return followUps;
        if (entity === PatientDiagnosis) return diagnosesRepository;
        return events;
      }),
    } as unknown as EntityManager;
    const patients = { upsertDetails: jest.fn() };
    const diagnosisCreate = jest.fn().mockResolvedValue({ id: 'diagnosis-id' });
    const transaction = jest.fn((callback: (value: EntityManager) => unknown) =>
      callback(manager),
    );
    const service = new PatientDiagnosticStatusesService(
      events as unknown as Repository<PatientDiagnosticStatusEvent>,
      { transaction } as unknown as DataSource,
      patients as unknown as PatientsService,
      { create: diagnosisCreate } as unknown as PatientDiagnosesService,
      {
        markDirty: jest.fn().mockResolvedValue(undefined),
      } as unknown as PatientSummaryInvalidationService,
    );

    const result = await service.transition('patient-id', {
      status: PatientDiagnosticStatus.CONFIRMED,
      followUpId: 'follow-up-id',
      diagnosis: {
        diagnosis: 'Cáncer de mama',
        mode: PatientDiagnosisMode.PARALLEL,
      },
    });

    expect(result).toBe(saved);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(diagnosisCreate).toHaveBeenCalledWith(
      'patient-id',
      expect.objectContaining({
        followUpId: 'follow-up-id',
        diagnosis: 'Cáncer de mama',
      }),
      manager,
    );
    expect(patients.upsertDetails).toHaveBeenCalledWith(
      'patient-id',
      { healthPhase: PatientHealthPhase.CANCER_DIAGNOSIS },
      manager,
    );
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PatientDiagnosticStatus.CONFIRMED,
        diagnosisId: 'diagnosis-id',
      }),
    );
  });

  it('transitions CONFIRMED to RULED_OUT and retires the formal diagnosis', async () => {
    const current = {
      status: PatientDiagnosticStatus.CONFIRMED,
      patientId: 'patient-id',
      diagnosisId: 'diagnosis-id',
    } as PatientDiagnosticStatusEvent;
    const saved = {
      id: 'event-ruled-out',
      patientId: 'patient-id',
      status: PatientDiagnosticStatus.RULED_OUT,
      diagnosisId: null,
    } as PatientDiagnosticStatusEvent;
    const patientQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'patient-id',
        role: PatientRole.PATIENT,
      }),
    };
    const events = {
      findOne: jest.fn().mockResolvedValue(current),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(saved),
    };
    const diagnosesRepository = { update: jest.fn().mockResolvedValue({}) };
    const followUps = { existsBy: jest.fn().mockResolvedValue(true) };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Patient)
          return { createQueryBuilder: jest.fn(() => patientQuery) };
        if (entity === FollowUp) return followUps;
        if (entity === PatientDiagnosis) return diagnosesRepository;
        return events;
      }),
    } as unknown as EntityManager;
    const patients = { upsertDetails: jest.fn() };
    const diagnosisCreate = jest.fn();
    const service = new PatientDiagnosticStatusesService(
      events as unknown as Repository<PatientDiagnosticStatusEvent>,
      {
        transaction: jest.fn((callback: (value: EntityManager) => unknown) =>
          callback(manager),
        ),
      } as unknown as DataSource,
      patients as unknown as PatientsService,
      { create: diagnosisCreate } as unknown as PatientDiagnosesService,
      {
        markDirty: jest.fn().mockResolvedValue(undefined),
      } as unknown as PatientSummaryInvalidationService,
    );

    const result = await service.transition('patient-id', {
      status: PatientDiagnosticStatus.RULED_OUT,
      followUpId: 'follow-up-id',
    });

    expect(result).toBe(saved);
    expect(diagnosesRepository.update).toHaveBeenCalledWith(
      {
        id: 'diagnosis-id',
        patientId: 'patient-id',
        isCurrent: true,
      },
      { isCurrent: false },
    );
    expect(diagnosisCreate).not.toHaveBeenCalled();
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PatientDiagnosticStatus.RULED_OUT,
        diagnosisId: null,
      }),
    );
    expect(patients.upsertDetails).toHaveBeenCalledWith(
      'patient-id',
      { healthSubcategory: PatientHealthSubcategory.CANCER_RULED_OUT },
      manager,
    );
  });

  it('transitions RULED_OUT to CONFIRMED by creating a new diagnosis', async () => {
    const current = {
      status: PatientDiagnosticStatus.RULED_OUT,
      patientId: 'patient-id',
      diagnosisId: null,
    } as PatientDiagnosticStatusEvent;
    const saved = {
      id: 'event-confirmed',
      patientId: 'patient-id',
      status: PatientDiagnosticStatus.CONFIRMED,
      diagnosisId: 'new-diagnosis-id',
    } as PatientDiagnosticStatusEvent;
    const patientQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'patient-id',
        role: PatientRole.PATIENT,
      }),
    };
    const events = {
      findOne: jest.fn().mockResolvedValue(current),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(saved),
    };
    const diagnosesRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const followUps = { existsBy: jest.fn().mockResolvedValue(true) };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Patient)
          return { createQueryBuilder: jest.fn(() => patientQuery) };
        if (entity === FollowUp) return followUps;
        if (entity === PatientDiagnosis) return diagnosesRepository;
        return events;
      }),
    } as unknown as EntityManager;
    const patients = { upsertDetails: jest.fn() };
    const diagnosisCreate = jest
      .fn()
      .mockResolvedValue({ id: 'new-diagnosis-id' });
    const service = new PatientDiagnosticStatusesService(
      events as unknown as Repository<PatientDiagnosticStatusEvent>,
      {
        transaction: jest.fn((callback: (value: EntityManager) => unknown) =>
          callback(manager),
        ),
      } as unknown as DataSource,
      patients as unknown as PatientsService,
      { create: diagnosisCreate } as unknown as PatientDiagnosesService,
      {
        markDirty: jest.fn().mockResolvedValue(undefined),
      } as unknown as PatientSummaryInvalidationService,
    );

    await service.transition('patient-id', {
      status: PatientDiagnosticStatus.CONFIRMED,
      followUpId: 'follow-up-id',
      diagnosis: {
        diagnosis: 'Cáncer de mama',
        mode: PatientDiagnosisMode.PARALLEL,
      },
    });

    expect(diagnosisCreate).toHaveBeenCalledWith(
      'patient-id',
      expect.objectContaining({ followUpId: 'follow-up-id' }),
      manager,
    );
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({ diagnosisId: 'new-diagnosis-id' }),
    );
  });

  it('reuses a current diagnosis when confirming an already confirmed event', async () => {
    const current = {
      status: PatientDiagnosticStatus.CONFIRMED,
      patientId: 'patient-id',
      diagnosisId: 'diagnosis-id',
    } as PatientDiagnosticStatusEvent;
    const patientQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'patient-id',
        role: PatientRole.PATIENT,
      }),
    };
    const events = {
      findOne: jest.fn().mockResolvedValue(current),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue({ id: 'event-confirmed-again' }),
    };
    const currentDiagnosis = { id: 'diagnosis-id', isCurrent: true };
    const diagnosesRepository = {
      findOne: jest.fn().mockResolvedValue(currentDiagnosis),
    };
    const followUps = { existsBy: jest.fn().mockResolvedValue(true) };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Patient)
          return { createQueryBuilder: jest.fn(() => patientQuery) };
        if (entity === FollowUp) return followUps;
        if (entity === PatientDiagnosis) return diagnosesRepository;
        return events;
      }),
    } as unknown as EntityManager;
    const patients = { upsertDetails: jest.fn() };
    const diagnosisCreate = jest.fn();
    const service = new PatientDiagnosticStatusesService(
      events as unknown as Repository<PatientDiagnosticStatusEvent>,
      {
        transaction: jest.fn((callback: (value: EntityManager) => unknown) =>
          callback(manager),
        ),
      } as unknown as DataSource,
      patients as unknown as PatientsService,
      { create: diagnosisCreate } as unknown as PatientDiagnosesService,
      {
        markDirty: jest.fn().mockResolvedValue(undefined),
      } as unknown as PatientSummaryInvalidationService,
    );

    await service.transition('patient-id', {
      status: PatientDiagnosticStatus.CONFIRMED,
      followUpId: 'follow-up-id',
      diagnosis: {
        diagnosis: 'Cáncer de mama',
        mode: PatientDiagnosisMode.PARALLEL,
      },
    });

    expect(diagnosesRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'diagnosis-id',
        patientId: 'patient-id',
        isCurrent: true,
      },
    });
    expect(diagnosisCreate).not.toHaveBeenCalled();
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PatientDiagnosticStatus.CONFIRMED,
        diagnosisId: 'diagnosis-id',
      }),
    );
  });

  it('derives the current search duration from the initial and current events', async () => {
    const searchingAt = new Date('2026-08-01T00:00:00.000Z');
    const resolvedAt = new Date('2026-08-03T03:00:00.000Z');
    const current = {
      id: 'event-ruled-out',
      patientId: 'patient-id',
      followUpId: 'follow-up-id',
      status: PatientDiagnosticStatus.RULED_OUT,
      occurredAt: resolvedAt,
      reportedDiagnosis: null,
      diagnosisId: null,
      supportedBySepa: true,
      notes: null,
      createdAt: resolvedAt,
    } as PatientDiagnosticStatusEvent;
    const searching = {
      occurredAt: searchingAt,
    } as PatientDiagnosticStatusEvent;
    const events = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(searching),
    };
    const patients = { assertCanRead: jest.fn().mockResolvedValue(undefined) };
    const service = new PatientDiagnosticStatusesService(
      events as unknown as Repository<PatientDiagnosticStatusEvent>,
      {} as DataSource,
      patients as unknown as PatientsService,
      {} as PatientDiagnosesService,
      {} as PatientSummaryInvalidationService,
    );

    await expect(
      service.responseForCurrent('patient-id', {} as never),
    ).resolves.toMatchObject({
      searchStartedAt: searchingAt.toISOString(),
      searchDurationMinutes: 3060,
    });
  });
});
