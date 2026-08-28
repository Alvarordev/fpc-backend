import { EntityManager, Repository } from 'typeorm';
import { Enrollment } from '../../../database/entities/enrollment.entity';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { PatientSymptomReport } from '../../../database/entities/patient-symptom-report.entity';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { PatientsService } from '../patients.service';
import { PatientSymptomReportsService } from './patient-symptom-reports.service';

describe('PatientSymptomReportsService', () => {
  function buildService() {
    const savedReports: unknown[] = [];
    const reportRepository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown) => {
        savedReports.push(value);
        return Promise.resolve({ ...(value as object), id: 'report-id' });
      }),
    };
    const followUps = {
      existsBy: jest.fn().mockResolvedValue(true),
    };
    const enrollments = {
      existsBy: jest.fn().mockResolvedValue(true),
    };
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
        return reportRepository;
      }),
    } as unknown as EntityManager;
    const service = new PatientSymptomReportsService(
      reportRepository as unknown as Repository<PatientSymptomReport>,
      followUps as unknown as Repository<FollowUp>,
      enrollments as unknown as Repository<Enrollment>,
      patients,
      invalidations,
    );
    return { service, reportRepository, manager, savedReports };
  }

  it('normalizes hidden conditional fields before persistence', async () => {
    const { service, manager, savedReports } = buildService();

    await service.create(
      'patient-id',
      {
        followUpId: 'follow-up-id',
        enrollmentId: 'enrollment-id',
        hasDiscomfort: true,
        checkupMotivation: 'stale motivation',
        hasRequestedMedicalConsultation: false,
        consultationStatus: 'NOT_OBTAINED',
        consultationNotObtainedReason: 'stale reason',
        healthCenterId: 'health-center-id',
        specialty: 'Oncology',
        hasReceivedDiagnosis: false,
        reportedDiagnosis: 'stale diagnosis',
        isReceivingReportedTreatment: false,
        reportedTreatment: 'stale treatment',
        reportedTreatmentFrequency: { valueMin: 1, unit: 'WEEK' },
        notReceivingTreatmentReason: 'No treatment yet',
      },
      manager,
    );

    expect(savedReports[0]).toEqual(
      expect.objectContaining({
        checkupMotivation: undefined,
        consultationStatus: undefined,
        consultationNotObtainedReason: undefined,
        healthCenterId: undefined,
        specialty: undefined,
        reportedDiagnosis: undefined,
        reportedTreatment: undefined,
      }),
    );
    const saved = savedReports[0] as {
      reportedTreatmentFrequency: Record<string, unknown>;
    };
    expect(saved.reportedTreatmentFrequency).toEqual({
      valueMin: null,
      valueMax: null,
      unit: null,
      label: null,
      canonicalMinutesMin: null,
      canonicalMinutesMax: null,
    });
  });

  it('requires motivation when the patient reports no discomfort', async () => {
    const { service, manager } = buildService();

    await expect(
      service.create(
        'patient-id',
        { followUpId: 'follow-up-id', hasDiscomfort: false },
        manager,
      ),
    ).rejects.toThrow('checkupMotivation is required');
  });

  it('requires a consultation status when a consultation was requested', async () => {
    const { service, manager } = buildService();

    await expect(
      service.create(
        'patient-id',
        {
          followUpId: 'follow-up-id',
          hasRequestedMedicalConsultation: true,
        },
        manager,
      ),
    ).rejects.toThrow('consultationStatus is required');
  });

  it('requires a reason when reported treatment is not being received', async () => {
    const { service, manager } = buildService();

    await expect(
      service.create(
        'patient-id',
        {
          followUpId: 'follow-up-id',
          isReceivingReportedTreatment: false,
        },
        manager,
      ),
    ).rejects.toThrow('notReceivingTreatmentReason is required');
  });
});
