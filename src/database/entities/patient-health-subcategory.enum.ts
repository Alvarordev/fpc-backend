import { PatientHealthPhase } from './patient-health-phase.enum';

export enum PatientHealthSubcategory {
  SIGNS_AND_SYMPTOMS_PATIENT = 'SIGNS_AND_SYMPTOMS_PATIENT',
  ACTIVE_TREATMENT = 'ACTIVE_TREATMENT',
  UNDER_CONTROLS = 'UNDER_CONTROLS',
  TREATMENT_ABANDONED = 'TREATMENT_ABANDONED',
  PALLIATIVE_NO_ACTIVE_TREATMENT = 'PALLIATIVE_NO_ACTIVE_TREATMENT',
  CANCER_RULED_OUT = 'CANCER_RULED_OUT',
}

export const ONCOLOGICAL_HEALTH_SUBCATEGORIES = [
  PatientHealthSubcategory.ACTIVE_TREATMENT,
  PatientHealthSubcategory.UNDER_CONTROLS,
  PatientHealthSubcategory.TREATMENT_ABANDONED,
  PatientHealthSubcategory.PALLIATIVE_NO_ACTIVE_TREATMENT,
] as const;

export const HEALTH_SUBCATEGORY_PHASE: Record<
  PatientHealthSubcategory,
  PatientHealthPhase
> = {
  [PatientHealthSubcategory.SIGNS_AND_SYMPTOMS_PATIENT]:
    PatientHealthPhase.SIGNS_AND_SYMPTOMS,
  [PatientHealthSubcategory.ACTIVE_TREATMENT]:
    PatientHealthPhase.CANCER_DIAGNOSIS,
  [PatientHealthSubcategory.UNDER_CONTROLS]:
    PatientHealthPhase.CANCER_DIAGNOSIS,
  [PatientHealthSubcategory.TREATMENT_ABANDONED]:
    PatientHealthPhase.CANCER_DIAGNOSIS,
  [PatientHealthSubcategory.PALLIATIVE_NO_ACTIVE_TREATMENT]:
    PatientHealthPhase.CANCER_DIAGNOSIS,
  [PatientHealthSubcategory.CANCER_RULED_OUT]:
    PatientHealthPhase.ANNUAL_CHECKUP,
};
