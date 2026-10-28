import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PatientDetails } from '../../../database/entities/patient-details.entity';
import { PatientHealthPhase } from '../../../database/entities/patient-health-phase.enum';
import { PatientHealthSubcategory } from '../../../database/entities/patient-health-subcategory.enum';
import { PatientTreatment } from '../../../database/entities/patient-treatment.entity';
import {
  ACTIVE_TREATMENT_SITUATIONS,
  TreatmentSituation,
} from '../../../database/entities/treatment-situation.enum';
import { PatientsService } from '../patients.service';

const PALLIATIVE_TREATMENT_TYPE = 'CUIDADOS_PALIATIVOS';

type TreatmentState = Pick<
  PatientTreatment,
  'treatmentType' | 'treatmentSituation'
>;

/**
 * Rule (E4): a cancer patient's subcategory follows their current treatments:
 * any non-palliative EN_PROCESO/EN_ESPERA/EN_BUSQUEDA → ACTIVE_TREATMENT;
 * otherwise an ongoing palliative treatment → PALLIATIVE_NO_ACTIVE_TREATMENT;
 * all CULMINADO/REMISION → UNDER_CONTROLS; only ABANDONADO →
 * TREATMENT_ABANDONED; any other mix keeps the current subcategory.
 */
export function deriveCancerSubcategory(
  treatments: TreatmentState[],
): PatientHealthSubcategory | null {
  const isPalliative = (treatment: TreatmentState) =>
    treatment.treatmentType === PALLIATIVE_TREATMENT_TYPE;
  const isActive = (treatment: TreatmentState) =>
    ACTIVE_TREATMENT_SITUATIONS.includes(treatment.treatmentSituation ?? '');
  if (treatments.some((item) => !isPalliative(item) && isActive(item)))
    return PatientHealthSubcategory.ACTIVE_TREATMENT;
  if (
    treatments.some(
      (item) =>
        isPalliative(item) && (isActive(item) || !item.treatmentSituation),
    )
  )
    return PatientHealthSubcategory.PALLIATIVE_NO_ACTIVE_TREATMENT;
  const situations = treatments
    .map((item) => item.treatmentSituation)
    .filter(
      (situation): situation is TreatmentSituation =>
        Boolean(situation) &&
        (situation as TreatmentSituation) !== TreatmentSituation.NO_APLICA,
    );
  if (!situations.length) return null;
  if (
    situations.every(
      (situation) =>
        situation === TreatmentSituation.CULMINADO ||
        situation === TreatmentSituation.REMISION,
    )
  )
    return PatientHealthSubcategory.UNDER_CONTROLS;
  if (
    situations.every((situation) => situation === TreatmentSituation.ABANDONADO)
  )
    return PatientHealthSubcategory.TREATMENT_ABANDONED;
  return null;
}

@Injectable()
export class PatientHealthSubcategoryService {
  constructor(private readonly patients: PatientsService) {}

  /**
   * Re-derives the subcategory of a cancer patient from their current
   * treatments. Callers skip it when the subcategory was sent explicitly.
   */
  async syncFromTreatments(
    patientId: string,
    manager: EntityManager,
    options: { changedAt?: Date } = {},
  ): Promise<string | null> {
    const details = await manager
      .getRepository(PatientDetails)
      .findOne({ where: { patientId } });
    if (details?.healthPhase !== PatientHealthPhase.CANCER_DIAGNOSIS)
      return details?.healthSubcategory ?? null;
    const treatments = await manager
      .getRepository(PatientTreatment)
      .createQueryBuilder('treatment')
      .innerJoin('treatment.diagnosis', 'diagnosis')
      .where('treatment.patient_id = :patientId', { patientId })
      .andWhere('treatment.is_current = true')
      .andWhere('diagnosis.is_current = true')
      .getMany();
    const derived = deriveCancerSubcategory(treatments);
    if (!derived || derived === details.healthSubcategory)
      return details.healthSubcategory;
    await this.patients.upsertDetails(
      patientId,
      { healthSubcategory: derived },
      manager,
      options,
    );
    return derived;
  }
}
