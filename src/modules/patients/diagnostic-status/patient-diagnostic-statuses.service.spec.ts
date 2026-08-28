import { DataSource, EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { PatientDiagnosticStatusEvent } from '../../../database/entities/patient-diagnostic-status-event.entity';
import { PatientDiagnosticStatus } from '../../../database/entities/patient-diagnostic-status.enum';
import { PatientRole } from '../../../database/entities/patient-role.enum';
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
    const service = new PatientDiagnosticStatusesService(
      events as unknown as Repository<PatientDiagnosticStatusEvent>,
      {
        transaction: jest.fn((callback: (value: EntityManager) => unknown) =>
          callback(manager),
        ),
      } as unknown as DataSource,
      {} as PatientsService,
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
  });
});
