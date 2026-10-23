import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PatientDiagnosisMode } from '../../../../../database/entities/patient-diagnosis-mode.enum';
import { CreatePatientDiagnosisDto } from './create-patient-diagnosis.dto';

describe('CreatePatientDiagnosisDto', () => {
  const base = {
    followUpId: '11111111-1111-4111-8111-111111111111',
    diagnosis: 'Breast cancer',
  };

  it('requires an explicit diagnosis mode', async () => {
    const errors = await validate(
      plainToInstance(CreatePatientDiagnosisDto, base),
    );

    expect(errors.map((error) => error.property)).toContain('mode');
  });

  it('requires a replacement diagnosis for REPLACE mode', async () => {
    const errors = await validate(
      plainToInstance(CreatePatientDiagnosisDto, {
        ...base,
        mode: PatientDiagnosisMode.REPLACE,
      }),
    );

    expect(errors.map((error) => error.property)).toContain(
      'replacementDiagnosisId',
    );
  });

  it('allows PARALLEL mode without a replacement target', async () => {
    const errors = await validate(
      plainToInstance(CreatePatientDiagnosisDto, {
        ...base,
        mode: PatientDiagnosisMode.PARALLEL,
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('accepts referral answers for a diagnosis', async () => {
    const errors = await validate(
      plainToInstance(CreatePatientDiagnosisDto, {
        ...base,
        mode: PatientDiagnosisMode.PARALLEL,
        referredHealthCenterId: '22222222-2222-4222-8222-222222222222',
        hasReferral: true,
      }),
    );

    expect(errors).toHaveLength(0);
  });
});
