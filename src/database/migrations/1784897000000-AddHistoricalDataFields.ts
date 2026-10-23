import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHistoricalDataFields1784897000000 implements MigrationInterface {
  name = 'AddHistoricalDataFields1784897000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "enrollments" ADD COLUMN "enrolled_on" date');
    await q.query(
      'ALTER TABLE "follow_ups" ADD COLUMN "scheduled_on" date, ADD COLUMN "completed_on" date',
    );
    await q.query(
      'ALTER TABLE "reminders" ADD COLUMN "due_on" date, ADD COLUMN "completed_on" date',
    );
    await q.query(
      'ALTER TABLE "psychooncology_appointments" ADD COLUMN "scheduled_on" date, ADD COLUMN "completed_on" date',
    );

    await q.query(
      `UPDATE "enrollments" enrollment
       SET "enrolled_on" = COALESCE(
         (follow_up."completed_at" AT TIME ZONE 'America/Lima')::date,
         (follow_up."scheduled_at" AT TIME ZONE 'America/Lima')::date,
         (follow_up."created_at" AT TIME ZONE 'America/Lima')::date,
         (enrollment."created_at" AT TIME ZONE 'America/Lima')::date
       )
       FROM "follow_ups" follow_up
       WHERE follow_up."id" = enrollment."follow_up_id"`,
    );
    await q.query(
      `ALTER TABLE "enrollments" ALTER COLUMN "enrolled_on" SET NOT NULL`,
    );
    await q.query(
      `UPDATE "follow_ups"
       SET "scheduled_on" = ("scheduled_at" AT TIME ZONE 'America/Lima')::date,
           "completed_on" = ("completed_at" AT TIME ZONE 'America/Lima')::date`,
    );
    await q.query(
      `UPDATE "reminders"
       SET "due_on" = ("due_at" AT TIME ZONE 'America/Lima')::date,
           "completed_on" = ("completed_at" AT TIME ZONE 'America/Lima')::date`,
    );
    await q.query(
      `UPDATE "psychooncology_appointments"
       SET "scheduled_on" = ("scheduled_at" AT TIME ZONE 'America/Lima')::date,
           "completed_on" = ("completed_at" AT TIME ZONE 'America/Lima')::date`,
    );

    await q.query(
      'ALTER TABLE "reminders" ALTER COLUMN "due_at" DROP NOT NULL',
    );
    await q.query(
      'ALTER TABLE "psychooncology_appointments" ALTER COLUMN "scheduled_at" DROP NOT NULL',
    );
    await q.query(
      'ALTER TABLE "volunteer_availability" ALTER COLUMN "start_time" DROP NOT NULL, ALTER COLUMN "end_time" DROP NOT NULL',
    );

    for (const table of [
      'enrollments',
      'follow_ups',
      'reminders',
      'patient_medical_appointments',
      'psychooncology_appointments',
      'volunteer_availability',
    ])
      await q.query(
        `ALTER TABLE "${table}" ADD COLUMN "is_historical" boolean NOT NULL DEFAULT false`,
      );
    await q.query(
      'ALTER TABLE "volunteers" ADD COLUMN "is_anonymous" boolean NOT NULL DEFAULT false',
    );

    await q.query(
      'ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "UQ_enrollments_patient_id"',
    );
    await q.query(
      'CREATE UNIQUE INDEX "UQ_enrollments_patient_id_operational" ON "enrollments" ("patient_id") WHERE "is_historical" = false',
    );
    await q.query(
      'CREATE INDEX "IDX_enrollments_enrolled_on" ON "enrollments" ("enrolled_on" DESC, "created_at" DESC, "id" DESC)',
    );
    await q.query(
      'CREATE INDEX "IDX_follow_ups_scheduled_on" ON "follow_ups" ("subject_patient_id", "scheduled_on" DESC, "created_at" DESC, "id" DESC)',
    );
    await q.query(
      'CREATE INDEX "IDX_reminders_due_on" ON "reminders" ("subject_patient_id", "due_on" DESC, "created_at" DESC, "id" DESC)',
    );
    await q.query(
      'CREATE INDEX "IDX_psychooncology_appointments_scheduled_on" ON "psychooncology_appointments" ("patient_id", "scheduled_on" DESC, "created_at" DESC, "id" DESC)',
    );

    await q.query(
      `INSERT INTO "users" ("email", "password_hash", "role", "is_active")
       VALUES ('voluntario-no-identificado@fpc.system', '!historical-system-volunteer-disabled!', 'VOLUNTEER', false)
       ON CONFLICT ("email") DO UPDATE
       SET "password_hash" = EXCLUDED."password_hash", "role" = EXCLUDED."role", "is_active" = false`,
    );
    await q.query(
      `INSERT INTO "volunteers"
        ("user_id", "first_name", "last_name", "specialty", "email", "phone", "is_active", "is_anonymous")
       SELECT "id", 'Voluntario', 'no identificado', 'Sistema', 'voluntario-no-identificado@fpc.system', 'N/A', false, true
       FROM "users"
       WHERE "email" = 'voluntario-no-identificado@fpc.system'
         AND NOT EXISTS (SELECT 1 FROM "volunteers" WHERE "is_anonymous" = true)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE FROM "volunteers"
       WHERE "is_anonymous" = true
          OR "email" = 'voluntario-no-identificado@fpc.system'`,
    );
    await q.query(
      `DELETE FROM "users" WHERE "email" = 'voluntario-no-identificado@fpc.system'`,
    );
    await q.query(
      'DROP INDEX IF EXISTS "IDX_psychooncology_appointments_scheduled_on"',
    );
    await q.query('DROP INDEX IF EXISTS "IDX_reminders_due_on"');
    await q.query('DROP INDEX IF EXISTS "IDX_follow_ups_scheduled_on"');
    await q.query('DROP INDEX IF EXISTS "IDX_enrollments_enrolled_on"');
    await q.query(
      'DROP INDEX IF EXISTS "UQ_enrollments_patient_id_operational"',
    );
    await q.query(
      'ALTER TABLE "volunteer_availability" ALTER COLUMN "start_time" SET NOT NULL, ALTER COLUMN "end_time" SET NOT NULL',
    );
    await q.query(
      'ALTER TABLE "psychooncology_appointments" ALTER COLUMN "scheduled_at" SET NOT NULL',
    );
    await q.query('ALTER TABLE "reminders" ALTER COLUMN "due_at" SET NOT NULL');
    for (const table of [
      'volunteer_availability',
      'psychooncology_appointments',
      'patient_medical_appointments',
      'reminders',
      'follow_ups',
      'enrollments',
    ])
      await q.query(`ALTER TABLE "${table}" DROP COLUMN "is_historical"`);
    await q.query('ALTER TABLE "volunteers" DROP COLUMN "is_anonymous"');
    await q.query(
      'ALTER TABLE "psychooncology_appointments" DROP COLUMN "completed_on"',
    );
    await q.query(
      'ALTER TABLE "psychooncology_appointments" DROP COLUMN "scheduled_on"',
    );
    await q.query('ALTER TABLE "reminders" DROP COLUMN "completed_on"');
    await q.query('ALTER TABLE "reminders" DROP COLUMN "due_on"');
    await q.query('ALTER TABLE "follow_ups" DROP COLUMN "completed_on"');
    await q.query('ALTER TABLE "follow_ups" DROP COLUMN "scheduled_on"');
    await q.query('ALTER TABLE "enrollments" DROP COLUMN "enrolled_on"');
    await q.query(
      'ALTER TABLE "enrollments" ADD CONSTRAINT "UQ_enrollments_patient_id" UNIQUE ("patient_id")',
    );
  }
}
