import { DataSource, EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import {
  PatientActiveComorbidity,
  PatientFamilyCancerHistory,
  PatientHealthBackgroundAssessment,
  PatientLimitation,
  LimitationCause,
} from '../../../../database/entities/patient-health-background-assessment.entity';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { PatientHealthBackgroundAssessmentsService } from './patient-health-background-assessments.service';

describe('PatientHealthBackgroundAssessmentsService', () => {
  it('persists an assessment and all its lists in the same transaction', async () => {
    const assessmentRepository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue({ id: 'assessment-id' }),
    };
    const comorbiditiesRepository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown[]) => Promise.resolve(value)),
    };
    const limitationsRepository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown[]) => Promise.resolve(value)),
    };
    const familyHistoryRepository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown[]) => Promise.resolve(value)),
    };
    const followUps = { existsBy: jest.fn().mockResolvedValue(true) };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === FollowUp) return followUps;
        if (entity === PatientHealthBackgroundAssessment)
          return assessmentRepository;
        if (entity === PatientActiveComorbidity) return comorbiditiesRepository;
        if (entity === PatientLimitation) return limitationsRepository;
        if (entity === PatientFamilyCancerHistory)
          return familyHistoryRepository;
        return familyHistoryRepository;
      }),
    } as unknown as EntityManager;
    const patients = {
      assertPatientRole: jest.fn().mockResolvedValue(undefined),
    } as unknown as PatientsService;
    const markDirty = jest.fn().mockResolvedValue(undefined);
    const invalidations = {
      markDirty,
    } as unknown as PatientSummaryInvalidationService;
    const service = new PatientHealthBackgroundAssessmentsService(
      {} as Repository<PatientHealthBackgroundAssessment>,
      followUps as unknown as Repository<FollowUp>,
      patients,
      {} as DataSource,
      invalidations,
    );

    const created = await service.create(
      'patient-id',
      {
        followUpId: 'follow-up-id',
        hasPsychiatry: false,
        activeComorbidities: [{ conditionName: 'Diabetes' }],
        limitations: [
          {
            description: 'Movilidad reducida',
            cause: LimitationCause.TREATMENT,
          },
        ],
        familyCancerHistory: [{ relationship: 'Madre', cancerType: 'Mama' }],
      },
      manager,
    );

    expect(assessmentRepository.create).toHaveBeenCalledWith({
      patientId: 'patient-id',
      followUpId: 'follow-up-id',
      hasPsychiatry: false,
    });
    expect(comorbiditiesRepository.save).toHaveBeenCalledWith([
      { conditionName: 'Diabetes', assessmentId: 'assessment-id' },
    ]);
    expect(limitationsRepository.save).toHaveBeenCalledWith([
      {
        description: 'Movilidad reducida',
        cause: 'TREATMENT',
        assessmentId: 'assessment-id',
      },
    ]);
    expect(familyHistoryRepository.save).toHaveBeenCalledWith([
      {
        relationship: 'Madre',
        cancerType: 'Mama',
        assessmentId: 'assessment-id',
      },
    ]);
    expect(created).toMatchObject({
      id: 'assessment-id',
      activeComorbidities: [{ conditionName: 'Diabetes' }],
    });
    expect(markDirty).toHaveBeenCalledWith('patient-id', manager);
  });
});
