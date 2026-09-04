import { Repository } from 'typeorm';
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
});
