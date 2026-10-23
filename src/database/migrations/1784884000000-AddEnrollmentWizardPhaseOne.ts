import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnrollmentWizardPhaseOne1784884000000 implements MigrationInterface {
  name = 'AddEnrollmentWizardPhaseOne1784884000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "patient_addresses" ADD COLUMN "location_url" text`,
    );

    await q.query(
      `ALTER TABLE "companion_patient" ADD COLUMN "contact_role" varchar(10)`,
    );
    await q.query(
      `ALTER TABLE "companion_patient" ADD CONSTRAINT "CHK_companion_patient_contact_role" CHECK ("contact_role" IS NULL OR "contact_role" IN ('PRIMARY','SECONDARY'))`,
    );
    await q.query(`UPDATE "companion_patient" SET "contact_role" = NULL`);
    await q.query(
      `UPDATE "companion_patient" SET "contact_role" = 'PRIMARY', "is_primary_contact" = true WHERE "id" IN (SELECT DISTINCT ON ("patient_id") "id" FROM "companion_patient" WHERE "is_primary_contact" = true ORDER BY "patient_id", "created_at", "id")`,
    );
    await q.query(
      `UPDATE "companion_patient" SET "is_primary_contact" = COALESCE("contact_role" = 'PRIMARY', false)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_companion_patient_primary_contact" ON "companion_patient" ("patient_id") WHERE "contact_role" = 'PRIMARY'`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_companion_patient_secondary_contact" ON "companion_patient" ("patient_id") WHERE "contact_role" = 'SECONDARY'`,
    );

    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "checkup_motivation" text`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "has_requested_medical_consultation" boolean`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "consultation_status" varchar(20)`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD CONSTRAINT "CHK_patient_symptom_reports_consultation_status" CHECK ("consultation_status" IS NULL OR "consultation_status" IN ('NOT_OBTAINED','SCHEDULED','ATTENDED'))`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "consultation_not_obtained_reason" text`,
    );
    for (const [name, type] of [
      ['diagnosis_search_duration_value_min', 'numeric(10,2)'],
      ['diagnosis_search_duration_value_max', 'numeric(10,2)'],
      ['diagnosis_search_duration_unit', 'varchar(10)'],
      ['diagnosis_search_duration_label', 'varchar(120)'],
      ['diagnosis_search_duration_canonical_minutes_min', 'integer'],
      ['diagnosis_search_duration_canonical_minutes_max', 'integer'],
    ] as const)
      await q.query(
        `ALTER TABLE "patient_symptom_reports" ADD COLUMN "${name}" ${type}`,
      );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "has_received_diagnosis" boolean`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "reported_diagnosis" text`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "is_receiving_reported_treatment" boolean`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "reported_treatment" text`,
    );
    for (const [name, type] of [
      ['reported_treatment_frequency_value_min', 'numeric(10,2)'],
      ['reported_treatment_frequency_value_max', 'numeric(10,2)'],
      ['reported_treatment_frequency_unit', 'varchar(10)'],
      ['reported_treatment_frequency_label', 'varchar(120)'],
      ['reported_treatment_frequency_canonical_minutes_min', 'integer'],
      ['reported_treatment_frequency_canonical_minutes_max', 'integer'],
    ] as const)
      await q.query(
        `ALTER TABLE "patient_symptom_reports" ADD COLUMN "${name}" ${type}`,
      );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "not_receiving_treatment_reason" text`,
    );

    await q.query(
      `ALTER TABLE "patient_medical_appointments" ADD COLUMN "referral_not_provided_reason" text`,
    );
    await q.query(
      `ALTER TABLE "patient_medical_appointments" ALTER COLUMN "has_referral_sheet" DROP DEFAULT`,
    );
    await q.query(
      `ALTER TABLE "patient_medical_appointments" ALTER COLUMN "has_referral_sheet" DROP NOT NULL`,
    );
    await q.query(
      `UPDATE "patient_medical_appointments" SET "has_referral_sheet" = NULL WHERE "has_referral_sheet" = false`,
    );

    await q.query(
      `CREATE TABLE "patient_diagnostic_status_events" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "follow_up_id" uuid REFERENCES "follow_ups"("id"), "status" varchar(20) NOT NULL, "occurred_at" timestamptz NOT NULL, "reported_diagnosis" text, "diagnosis_id" uuid REFERENCES "patient_diagnoses"("id"), "supported_by_sepa" boolean, "notes" text, "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "CHK_patient_diagnostic_status_events_status" CHECK ("status" IN ('SEARCHING','CONFIRMED','RULED_OUT')))`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_diagnostic_status_events_patient_occurred" ON "patient_diagnostic_status_events" ("patient_id", "occurred_at" DESC, "id" DESC)`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_diagnostic_status_events_status_occurred" ON "patient_diagnostic_status_events" ("status", "occurred_at" DESC)`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_diagnostic_status_events_follow_up_id" ON "patient_diagnostic_status_events" ("follow_up_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_diagnostic_status_events_diagnosis_id" ON "patient_diagnostic_status_events" ("diagnosis_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "patient_diagnostic_status_events"`);

    await q.query(
      `UPDATE "patient_medical_appointments" SET "has_referral_sheet" = false WHERE "has_referral_sheet" IS NULL`,
    );
    await q.query(
      `ALTER TABLE "patient_medical_appointments" ALTER COLUMN "has_referral_sheet" SET NOT NULL`,
    );
    await q.query(
      `ALTER TABLE "patient_medical_appointments" ALTER COLUMN "has_referral_sheet" SET DEFAULT false`,
    );
    await q.query(
      `ALTER TABLE "patient_medical_appointments" DROP COLUMN "referral_not_provided_reason"`,
    );

    for (const name of [
      'not_receiving_treatment_reason',
      'reported_treatment_frequency_canonical_minutes_max',
      'reported_treatment_frequency_canonical_minutes_min',
      'reported_treatment_frequency_label',
      'reported_treatment_frequency_unit',
      'reported_treatment_frequency_value_max',
      'reported_treatment_frequency_value_min',
      'reported_treatment',
      'is_receiving_reported_treatment',
      'reported_diagnosis',
      'has_received_diagnosis',
      'diagnosis_search_duration_canonical_minutes_max',
      'diagnosis_search_duration_canonical_minutes_min',
      'diagnosis_search_duration_label',
      'diagnosis_search_duration_unit',
      'diagnosis_search_duration_value_max',
      'diagnosis_search_duration_value_min',
      'consultation_not_obtained_reason',
    ])
      await q.query(
        `ALTER TABLE "patient_symptom_reports" DROP COLUMN "${name}"`,
      );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" DROP CONSTRAINT "CHK_patient_symptom_reports_consultation_status"`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" DROP COLUMN "consultation_status"`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" DROP COLUMN "has_requested_medical_consultation"`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" DROP COLUMN "checkup_motivation"`,
    );

    await q.query(`DROP INDEX "UQ_companion_patient_secondary_contact"`);
    await q.query(`DROP INDEX "UQ_companion_patient_primary_contact"`);
    await q.query(
      `ALTER TABLE "companion_patient" DROP CONSTRAINT "CHK_companion_patient_contact_role"`,
    );
    await q.query(`ALTER TABLE "companion_patient" DROP COLUMN "contact_role"`);
    await q.query(`ALTER TABLE "patient_addresses" DROP COLUMN "location_url"`);
  }
}
