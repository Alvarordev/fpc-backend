import { validate } from 'class-validator';
import { TreatmentSituation } from '../../../../../database/entities/treatment-situation.enum';
import { CreatePatientTreatmentDto } from './create-patient-treatment.dto';

describe('CreatePatientTreatmentDto', () => {
  const base = {
    followUpId: '00000000-0000-4000-8000-000000000001',
    diagnosisId: '00000000-0000-4000-8000-000000000002',
    treatmentType: 'Quimioterapia',
  };

  it('requires an abandonment reason only for abandoned treatments', async () => {
    const missingReason = Object.assign(new CreatePatientTreatmentDto(), {
      ...base,
      treatmentSituation: TreatmentSituation.ABANDONED,
    });
    const valid = Object.assign(new CreatePatientTreatmentDto(), {
      ...base,
      treatmentSituation: TreatmentSituation.ABANDONED,
      treatmentAbandonmentReason: 'Decisión del paciente',
    });

    expect(await validate(missingReason)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'treatmentAbandonmentReason' }),
      ]),
    );
    expect(await validate(valid)).toHaveLength(0);
  });

  it('requires an interruption reason only for interrupted treatments', async () => {
    const missingReason = Object.assign(new CreatePatientTreatmentDto(), {
      ...base,
      treatmentSituation: TreatmentSituation.INTERRUMPIDO,
    });
    const valid = Object.assign(new CreatePatientTreatmentDto(), {
      ...base,
      treatmentSituation: TreatmentSituation.INTERRUMPIDO,
      interruptionReason: 'ADVERSE_REACTION',
    });

    expect(await validate(missingReason)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'interruptionReason' }),
      ]),
    );
    expect(await validate(valid)).toHaveLength(0);
  });

  it('rejects teleconsultation details when teleconsultation is disabled', async () => {
    const staleDetails = Object.assign(new CreatePatientTreatmentDto(), {
      ...base,
      receivesTeleconsultation: false,
      teleconsultationNote: 'Seguimiento virtual',
    });
    const clearedDetails = Object.assign(new CreatePatientTreatmentDto(), {
      ...base,
      receivesTeleconsultation: false,
      teleconsultationSpecialties: [],
    });

    expect(await validate(staleDetails)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'receivesTeleconsultation' }),
      ]),
    );
    expect(await validate(clearedDetails)).toHaveLength(0);
  });
});
