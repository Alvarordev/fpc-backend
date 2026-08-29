import { DataSource, EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { PatientPsychooncologySupportAssessment } from '../../../../database/entities/patient-psychooncology-support-assessment.entity';
import { AppointmentModality } from '../../../../database/entities/psychooncology-appointment.entity';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { PatientsService } from '../../patients.service';
import { PatientPsychooncologySupportAssessmentsService } from './patient-psychooncology-support-assessments.service';

describe('PatientPsychooncologySupportAssessmentsService', () => {
  it('persists optional enrollment answers in the supplied transaction', async () => {
    const assessmentRepository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const followUps = { existsBy: jest.fn().mockResolvedValue(true) };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === FollowUp ? followUps : assessmentRepository,
      ),
    } as unknown as EntityManager;
    const patients = {
      assertPatientRole: jest.fn().mockResolvedValue(undefined),
    } as unknown as PatientsService;
    const markDirty = jest.fn().mockResolvedValue(undefined);
    const invalidations = {
      markDirty,
    } as unknown as PatientSummaryInvalidationService;
    const service = new PatientPsychooncologySupportAssessmentsService(
      {} as Repository<PatientPsychooncologySupportAssessment>,
      followUps as unknown as Repository<FollowUp>,
      patients,
      {} as DataSource,
      invalidations,
    );

    await service.create(
      'patient-id',
      {
        followUpId: 'follow-up-id',
        excessiveWorry: false,
        emotionalDistressScore: 6,
        preferredModality: AppointmentModality.VIDEO_CALL,
      },
      manager,
    );

    expect(assessmentRepository.create).toHaveBeenCalledWith({
      patientId: 'patient-id',
      followUpId: 'follow-up-id',
      excessiveWorry: false,
      emotionalDistressScore: 6,
      preferredModality: AppointmentModality.VIDEO_CALL,
    });
    expect(assessmentRepository.save).toHaveBeenCalledTimes(1);
    expect(markDirty).toHaveBeenCalledWith('patient-id', manager);
  });
});
