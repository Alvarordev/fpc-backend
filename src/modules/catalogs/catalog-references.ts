import type { CatalogKind } from '../../database/entities/catalog-item.entity';

export type CatalogReference = {
  table: string;
  column: string;
  array?: boolean;
};

/**
 * Columns that store a catalog code, per kind. Built from the
 * `catalogValues.resolve('<kind>', …)` call sites; keep it in sync when a
 * new column starts storing catalog codes, or merges will miss it.
 */
export const CATALOG_REFERENCES: Partial<
  Record<CatalogKind, CatalogReference[]>
> = {
  cancer_stage: [{ table: 'patient_diagnoses', column: 'cancer_stage' }],
  education_level: [{ table: 'patient_details', column: 'education_level' }],
  insurance_type: [{ table: 'patient_insurance', column: 'insurance_type' }],
  eps_provider: [{ table: 'patient_insurance', column: 'eps_provider' }],
  native_language: [{ table: 'patient_details', column: 'native_language' }],
  medical_specialty: [
    { table: 'patient_diagnoses', column: 'diagnosis_specialty' },
    { table: 'patient_medical_appointments', column: 'specialty' },
    {
      table: 'patient_medical_appointments',
      column: 'next_appointment_specialty',
    },
    {
      table: 'patient_non_oncological_follow_ups',
      column: 'control_specialty',
    },
    { table: 'patient_symptom_reports', column: 'specialty' },
    {
      table: 'patient_treatments',
      column: 'teleconsultation_specialties',
      array: true,
    },
    { table: 'referrals', column: 'specialty' },
  ],
  cancer_diagnosis: [
    { table: 'patient_diagnoses', column: 'diagnosis' },
    { table: 'patient_diagnostic_status_events', column: 'reported_diagnosis' },
  ],
  entry_source: [
    { table: 'enrollments', column: 'entry_source' },
    { table: 'follow_up_reenrollments', column: 'entry_source' },
  ],
  entry_sub_source: [
    { table: 'enrollments', column: 'entry_sub_source' },
    { table: 'follow_up_reenrollments', column: 'entry_sub_source' },
  ],
  reenrollment_reason: [{ table: 'follow_up_reenrollments', column: 'reason' }],
  companion_relationship: [{ table: 'companion_patient', column: 'relationship' }],
  zone_type: [{ table: 'patient_details', column: 'zone_type' }],
  care_program: [{ table: 'patient_treatments', column: 'care_program' }],
  access_barrier: [
    { table: 'patient_treatments', column: 'access_barrier_code' },
  ],
  treatment_situation: [
    { table: 'patient_treatments', column: 'treatment_situation' },
  ],
  sepa_shelter: [{ table: 'patient_details', column: 'shelter_sepa_provider' }],
  sepa_transport: [
    { table: 'patient_details', column: 'transportation_sepa_provider' },
  ],
  alert_category: [{ table: 'alerts', column: 'category' }],
  alert_derivation_entity: [{ table: 'alerts', column: 'derived_to' }],
  patient_health_phase: [
    { table: 'patient_details', column: 'health_phase' },
    { table: 'patient_health_phase_history', column: 'health_phase' },
  ],
  patient_health_subcategory: [
    { table: 'patient_details', column: 'health_subcategory' },
    {
      table: 'patient_health_subcategory_history',
      column: 'health_subcategory',
    },
  ],
  treatment_type: [{ table: 'patient_treatments', column: 'treatment_type' }],
  country: [{ table: 'patient_details', column: 'birth_country' }],
  chemotherapy_route: [
    { table: 'patient_treatments', column: 'chemotherapy_route' },
  ],
  surgical_procedure: [
    { table: 'patient_treatments', column: 'operation_name' },
  ],
  location_share_status: [
    { table: 'patient_addresses', column: 'location_share_status' },
  ],
  temporary_housing_type: [
    { table: 'patient_addresses', column: 'housing_type' },
  ],
};

/** Kinds whose items point at a parent item of another kind via parent_code. */
export const CATALOG_CHILD_KINDS: Partial<Record<CatalogKind, CatalogKind[]>> =
  {
    entry_source: ['entry_sub_source'],
    patient_health_phase: ['patient_health_subcategory'],
    cancer_diagnosis: ['cancer_diagnosis'],
  };
