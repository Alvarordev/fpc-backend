import type { EntityManager } from 'typeorm';

/**
 * Every domain table, listed explicitly. Discovering tables dynamically would
 * risk truncating TypeORM's `migrations` bookkeeping table, which must survive.
 */
const DOMAIN_TABLES = [
  'patient_summary_rate_limits',
  'patient_summaries',
  'alerts',
  'reminders',
  'psychooncology_appointments',
  'volunteer_availability',
  'enrollment_family_talk_interests',
  'enrollments',
  'patient_symptom_reports',
  'patient_sis_affiliation',
  'patient_treatments',
  'patient_medical_appointments',
  'patient_insurance',
  'patient_diagnoses',
  'companion_patient',
  'patient_details',
  'patients',
  'follow_ups',
  'health_centers',
  'agents',
  'volunteers',
  'refresh_tokens',
  'users',
] as const;

/**
 * Wipes all domain data. `CASCADE` covers any foreign key not implied by the
 * order above; `RESTART IDENTITY` is a no-op today (every PK is a uuid) but
 * keeps the reset correct if a sequence is ever added.
 */
export async function resetDomainTables(manager: EntityManager): Promise<void> {
  const tables = DOMAIN_TABLES.map((table) => `"${table}"`).join(', ');
  await manager.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}
