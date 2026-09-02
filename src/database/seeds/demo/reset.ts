import type { EntityManager } from 'typeorm';

/**
 * Every domain table, listed explicitly. Discovering tables dynamically would
 * risk truncating TypeORM's `migrations` bookkeeping table, which must survive.
 */
export const DOMAIN_TABLES = [
  'patient_documents',
  'patient_social_notes',
  'patient_summary_rate_limits',
  'patient_summaries',
  'alert_events',
  'alerts',
  'reminders',
  'patient_psychooncology_support_assessments',
  'psychooncology_appointments',
  'volunteer_availability',
  'enrollment_family_talk_interests',
  'enrollments',
  'patient_diagnostic_status_events',
  'patient_symptom_reports',
  'patient_sis_affiliation',
  'treatment_medications',
  'patient_treatments',
  'patient_medical_appointments',
  'patient_insurance',
  'patient_diagnoses',
  'companion_patient',
  'patient_health_phase_history',
  'patient_family_cancer_history',
  'patient_limitations',
  'patient_active_comorbidities',
  'patient_health_background_assessments',
  'patient_addresses',
  'patient_details',
  'patients',
  'follow_ups',
  'health_centers',
  'foundations',
  'agents',
  'volunteers',
  'refresh_tokens',
  'users',
  'catalog_items',
  'ubigeo_districts',
  'ubigeo_provinces',
  'ubigeo_departments',
] as const;

/**
 * Wipes all domain data. `CASCADE` covers any foreign key not implied by the
 * order above; `RESTART IDENTITY` is a no-op today (every PK is a uuid) but
 * keeps the reset correct if a sequence is ever added.
 *
 * Tables that do not exist yet (e.g. before catalog migrations) are skipped
 * so older environments can still reset.
 */
export async function resetDomainTables(manager: EntityManager): Promise<void> {
  const existing = new Set<string>(
    (
      await manager.query<{ tablename: string }[]>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      )
    ).map((row) => row.tablename),
  );

  const tables = DOMAIN_TABLES.filter((table) => existing.has(table)).map(
    (table) => `"${table}"`,
  );

  if (tables.length === 0) {
    throw new Error('No domain tables found to truncate');
  }

  await manager.query(
    `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
  );
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
