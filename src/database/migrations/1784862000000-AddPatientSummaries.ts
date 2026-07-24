import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientSummaries1784862000000 implements MigrationInterface {
  name = 'AddPatientSummaries1784862000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "patient_summaries" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL UNIQUE REFERENCES "patients"("id") ON DELETE CASCADE, "status" varchar(20) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','PROCESSING','READY','FAILED')), "summary" text, "model" varchar(100), "error_code" varchar(50), "error_message" varchar(255), "attempt_count" integer NOT NULL DEFAULT 0, "available_at" timestamptz NOT NULL DEFAULT now(), "processing_started_at" timestamptz, "completed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      'CREATE INDEX "IDX_patient_summaries_status_available_at" ON "patient_summaries" ("status", "available_at")',
    );
    await q.query(
      `CREATE TABLE "patient_summary_rate_limits" ("key" varchar(50) PRIMARY KEY, "window_started_at" timestamptz NOT NULL, "used_count" integer NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `INSERT INTO "patient_summary_rate_limits" ("key", "window_started_at") VALUES ('gemini', now())`,
    );
    await q.query(
      `INSERT INTO "patient_summaries" ("patient_id") SELECT "id" FROM "patients"`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "patient_summary_rate_limits"');
    await q.query('DROP TABLE "patient_summaries"');
  }
}
