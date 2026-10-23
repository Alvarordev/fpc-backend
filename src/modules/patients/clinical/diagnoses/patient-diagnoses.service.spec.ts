import { EntityManager, Repository } from 'typeorm';
import { PatientDiagnosisRevision } from '../../../../database/entities/patient-diagnosis-revision.entity';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { HealthCenter } from '../../../../database/entities/health-center.entity';
import { PatientDiagnosis } from '../../../../database/entities/patient-diagnosis.entity';
import { PatientDiagnosisMode } from '../../../../database/entities/patient-diagnosis-mode.enum';
import { PatientDiagnosesService } from './patient-diagnoses.service';

describe('PatientDiagnosesService', () => {
  it('rejects a referred health center that is missing or inactive', async () => {
    const healthCenters = {
      existsBy: jest.fn().mockResolvedValue(false),
    };
    const service = new PatientDiagnosesService(
      {} as Repository<PatientDiagnosis>,
      { existsBy: jest.fn().mockResolvedValue(true) } as Repository<FollowUp>,
      healthCenters as unknown as Repository<HealthCenter>,
      { assertPatientRole: jest.fn() } as never,
      {} as never,
      {} as never,
      {
        resolve: jest.fn(async (_kind: string, value: string) => ({
          code: value,
          label: value,
          other: null,
        })),
        resolveOptional: jest.fn(),
      } as never,
    );

    await expect(
      service.create('patient-id', {
        followUpId: 'follow-up-id',
        diagnosis: 'Cáncer de mama',
        mode: PatientDiagnosisMode.PARALLEL,
        referredHealthCenterId: 'health-center-id',
      }),
    ).rejects.toThrow('Referred health center not found');
    expect(healthCenters.existsBy).toHaveBeenCalledWith({
      id: 'health-center-id',
      isActive: true,
    });
  });

  describe('update', () => {
    function setup(diagnosis: Partial<PatientDiagnosis>) {
      const diagnoses = {
        findOne: jest.fn().mockResolvedValue(diagnosis),
        save: jest.fn((value: PatientDiagnosis) => Promise.resolve(value)),
      };
      const revisions = { save: jest.fn() };
      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === PatientDiagnosis) return diagnoses;
          if (entity === PatientDiagnosisRevision) return revisions;
          return { existsBy: jest.fn().mockResolvedValue(true) };
        }),
      } as unknown as EntityManager;
      const invalidations = { markDirty: jest.fn() };
      const service = new PatientDiagnosesService(
        {} as Repository<PatientDiagnosis>,
        {} as Repository<FollowUp>,
        {} as Repository<HealthCenter>,
        { assertPatientRole: jest.fn() } as never,
        {} as never,
        invalidations as never,
        {
          resolveOptional: jest.fn((_kind: string, value?: string) =>
            Promise.resolve(
              value ? { code: value, label: value, other: null } : null,
            ),
          ),
        } as never,
      );
      return { service, manager, diagnoses, revisions, invalidations };
    }

    it('corrects in place and logs only the overwritten values', async () => {
      const { service, manager, diagnoses, revisions, invalidations } = setup({
        id: 'diagnosis-id',
        patientId: 'patient-id',
        isCurrent: true,
        diagnosis: 'BREAST',
        cancerStage: 'STAGE_1',
        hasMedicalReport: false,
        diagnosisDate: null,
        firstSymptomsDate: null,
      });

      const result = await service.update(
        'patient-id',
        'diagnosis-id',
        {
          followUpId: 'follow-up-id',
          changeReason: ' Etapa mal cargada ',
          cancerStage: 'STAGE_2',
          hasMedicalReport: false,
        },
        { id: 'user-id' } as never,
        manager,
      );

      expect(result.id).toBe('diagnosis-id');
      expect(result.cancerStage).toBe('STAGE_2');
      expect(result.diagnosis).toBe('BREAST');
      expect(revisions.save).toHaveBeenCalledWith({
        diagnosisId: 'diagnosis-id',
        followUpId: 'follow-up-id',
        changedById: 'user-id',
        changeReason: 'Etapa mal cargada',
        previousValues: { cancerStage: 'STAGE_1' },
      });
      expect(diagnoses.save).toHaveBeenCalled();
      expect(invalidations.markDirty).toHaveBeenCalledWith(
        'patient-id',
        manager,
      );
    });

    it('rejects a diagnosis that is no longer active', async () => {
      const { service, manager } = setup({
        id: 'diagnosis-id',
        patientId: 'patient-id',
        isCurrent: false,
      });

      await expect(
        service.update(
          'patient-id',
          'diagnosis-id',
          { followUpId: 'follow-up-id', changeReason: 'x', cancerStage: null },
          undefined,
          manager,
        ),
      ).rejects.toThrow('Only an active diagnosis can be corrected');
    });

    it('skips the write when nothing changes', async () => {
      const { service, manager, diagnoses, revisions } = setup({
        id: 'diagnosis-id',
        patientId: 'patient-id',
        isCurrent: true,
        cancerStage: 'STAGE_1',
      });

      await service.update(
        'patient-id',
        'diagnosis-id',
        {
          followUpId: 'follow-up-id',
          changeReason: 'x',
          cancerStage: 'STAGE_1',
        },
        undefined,
        manager,
      );

      expect(revisions.save).not.toHaveBeenCalled();
      expect(diagnoses.save).not.toHaveBeenCalled();
    });
  });
});
