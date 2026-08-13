import 'dotenv/config';
import dataSource from '../data-source';
import { seedAlerts } from './demo/alerts';
import { seedClinicalHistory } from './demo/clinical-history';
import type { DemoContext } from './demo/context';
import { seedEnrollments } from './demo/enrollments';
import { seedFollowUps } from './demo/follow-ups';
import { seedHealthCenters } from './demo/health-centers';
import { seedPatients } from './demo/patients';
import { seedPsychooncology } from './demo/psychooncology';
import { seedReminders } from './demo/reminders';
import { resetDomainTables } from './demo/reset';
import { Rng } from './demo/rng';
import { seedPatientSummaries } from './demo/summaries';
import { DEMO_PASSWORD, seedUsers } from './demo/users';

const DEFAULT_SEED = 20260805;

/** Tables reported in the final summary, in reading order. */
const REPORTED_TABLES = [
  'users',
  'agents',
  'volunteers',
  'health_centers',
  'patients',
  'companion_patient',
  'patient_details',
  'follow_ups',
  'enrollments',
  'enrollment_family_talk_interests',
  'patient_diagnoses',
  'patient_insurance',
  'patient_treatments',
  'patient_medical_appointments',
  'patient_sis_affiliation',
  'patient_symptom_reports',
  'patient_addresses',
  'treatment_medications',
  'volunteer_availability',
  'psychooncology_appointments',
  'reminders',
  'alerts',
  'patient_summaries',
] as const;

function resolveNow(): Date {
  const override = process.env.SEED_DEMO_NOW;
  const base = override ? new Date(override) : new Date();

  if (Number.isNaN(base.getTime())) {
    throw new Error(`SEED_DEMO_NOW is not a valid date: ${override ?? ''}`);
  }

  // Anchor to midnight UTC so repeated runs on the same day are identical.
  base.setUTCHours(0, 0, 0, 0);
  return base;
}

function resolveSeed(): number {
  const raw = process.env.SEED_DEMO_SEED;
  if (!raw) return DEFAULT_SEED;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`SEED_DEMO_SEED must be an integer, got: ${raw}`);
  }
  return parsed;
}

async function seedDemo(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_DEMO_FORCE) {
    throw new Error(
      'Refusing to run the demo seed with NODE_ENV=production — it deletes all data. Set SEED_DEMO_FORCE=true to override.',
    );
  }

  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const ctx: DemoContext = {
        manager,
        rng: new Rng(resolveSeed()),
        now: resolveNow(),
      };

      await resetDomainTables(manager);

      const users = await seedUsers(manager);
      const healthCenters = await seedHealthCenters(ctx);
      const patients = await seedPatients(ctx, healthCenters);
      const histories = await seedFollowUps(ctx, patients, users.agents);
      const enrollments = await seedEnrollments(ctx, histories);

      await seedClinicalHistory(ctx, histories, enrollments, healthCenters);
      await seedPsychooncology(ctx, histories, users.volunteers);
      await seedReminders(ctx, histories, users.agents);
      await seedAlerts(ctx, histories, users.agents);
      await seedPatientSummaries(ctx, histories);
    });

    await report();
  } finally {
    await dataSource.destroy();
  }
}

async function report(): Promise<void> {
  const lines: string[] = [];

  for (const table of REPORTED_TABLES) {
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "${table}"`,
    );
    lines.push(`  ${table.padEnd(34)} ${count.padStart(4)}`);
  }

  console.log('\nDatos de demo creados:\n');
  console.log(lines.join('\n'));
  console.log(
    `\nAcceso: admin -> ${process.env.SEED_ADMIN_EMAIL ?? '(SEED_ADMIN_EMAIL)'}` +
      `\n        resto -> *@fpc.demo con la contraseña ${DEMO_PASSWORD}\n`,
  );
}

void seedDemo().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
