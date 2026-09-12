import { DataSource, EntityManager, Repository } from 'typeorm';
import { Enrollment } from '../../../../database/entities/enrollment.entity';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { PatientNonOncologicalFollowUp } from '../../../../database/entities/patient-non-oncological-follow-up.entity';
import { PatientNonOncologicalFollowUpStatus } from '../../../../database/entities/patient-non-oncological-follow-up-status.enum';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { PatientsService } from '../../patients.service';
import { PatientNonOncologicalFollowUpsService } from './patient-non-oncological-follow-ups.service';

describe('PatientNonOncologicalFollowUpsService', () => {
  function buildService() {
    const savedRecords: unknown[] = [];
    const repository = {
      create: jest.fn((value: unknown) => value),
      findOne: jest.fn(),
      save: jest.fn((value: unknown) => {
        savedRecords.push(value);
        return Promise.resolve(value);
      }),
    };
    const followUps = { existsBy: jest.fn().mockResolvedValue(true) };
    const enrollments = { existsBy: jest.fn().mockResolvedValue(true) };
    const patients = {
      assertPatientRole: jest.fn().mockResolvedValue(undefined),
    } as unknown as PatientsService;
    const invalidations = {
      markDirty: jest.fn().mockResolvedValue(undefined),
    } as unknown as PatientSummaryInvalidationService;
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === FollowUp) return followUps;
        if (entity === Enrollment) return enrollments;
        return repository;
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((callback: (value: EntityManager) => unknown) =>
        callback(manager),
      ),
    } as unknown as DataSource;
    const service = new PatientNonOncologicalFollowUpsService(
      repository as unknown as Repository<PatientNonOncologicalFollowUp>,
      followUps as unknown as Repository<FollowUp>,
      enrollments as unknown as Repository<Enrollment>,
      dataSource,
      patients,
      invalidations,
    );
    return { service, manager, repository, savedRecords };
  }

  it('creates an active record while preserving explicit unknown answers', async () => {
    const { service, manager, repository, savedRecords } = buildService();

    await service.create(
      'patient-id',
      {
        followUpId: 'follow-up-id',
        enrollmentId: 'enrollment-id',
        diagnosis: '  Hipertensión  ',
        receivesTreatment: null,
        hasControls: null,
      },
      manager,
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-id',
        followUpId: 'follow-up-id',
        enrollmentId: 'enrollment-id',
        diagnosis: 'Hipertensión',
        receivesTreatment: null,
        hasControls: null,
        status: PatientNonOncologicalFollowUpStatus.ACTIVE,
      }),
    );
    expect(savedRecords).toHaveLength(1);
  });

  it('requires discharge reason when creating a discharged record', async () => {
    const { service, manager } = buildService();

    await expect(
      service.create(
        'patient-id',
        {
          diagnosis: 'Hipertensión',
          status: PatientNonOncologicalFollowUpStatus.DISCHARGED,
        },
        manager,
      ),
    ).rejects.toThrow(
      'dischargeReason is required when the follow-up is discharged',
    );
  });

  it('clears discharge data when an existing record becomes active', async () => {
    const { service, repository } = buildService();
    const existing = {
      id: 'record-id',
      patientId: 'patient-id',
      diagnosis: 'Hipertensión',
      status: PatientNonOncologicalFollowUpStatus.DISCHARGED,
      dischargedOn: '2026-08-01',
      dischargeReason: 'Resuelto',
      receivesTreatment: null,
      hasControls: null,
      followUpId: null,
      enrollmentId: null,
      diagnosticStatusEventId: null,
    } as PatientNonOncologicalFollowUp;
    repository.findOne.mockResolvedValue(existing);

    const updated = await service.update('patient-id', 'record-id', {
      status: PatientNonOncologicalFollowUpStatus.ACTIVE,
    });

    expect(updated).toEqual(
      expect.objectContaining({
        status: PatientNonOncologicalFollowUpStatus.ACTIVE,
        dischargedOn: null,
        dischargeReason: null,
      }),
    );
  });
});
