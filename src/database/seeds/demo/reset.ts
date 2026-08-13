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
  'treatment_medications',
  'patient_treatments',
  'patient_medical_appointments',
  'patient_insurance',
  'patient_diagnoses',
  'companion_patient',
  'patient_addresses',
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
  // patient_summary_rate_limits is infrastructure state, not demo data: the
  // 'gemini' row is a singleton bucket the app expects to always exist
  // (see PatientSummaryRateLimiterService.tryAcquire, which uses
  // getOneOrFail). The initial migration inserts it once at table creation;
  // restore it here too since this truncate would otherwise leave every
  // patient-summary request 500ing until someone reinserts it by hand.
  await manager.query(
    `INSERT INTO "patient_summary_rate_limits" ("key", "window_started_at") VALUES ('gemini', now())`,
  );
}
