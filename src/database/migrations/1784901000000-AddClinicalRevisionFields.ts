import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClinicalRevisionFields1784901000000 implements MigrationInterface {
  name = 'AddClinicalRevisionFields1784901000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "patient_symptom_reports"
        ADD COLUMN "has_medical_consultation" boolean,
        ADD COLUMN "no_medical_consultation_reason" text,
        ADD COLUMN "first_consultation_date" date,
        ADD COLUMN "is_awaiting_diagnosis" boolean,
        ADD COLUMN "has_referral" boolean,
        ADD COLUMN "referred_health_center_id" uuid REFERENCES "health_centers"("id"),
        ADD COLUMN "referral_not_provided_reason" text,
        ADD COLUMN "next_consultation_date" date`,
    );

    await q.query(
      `CREATE TABLE "patient_non_oncological_follow_ups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL REFERENCES "patients"("id"),
        "follow_up_id" uuid REFERENCES "follow_ups"("id"),
        "enrollment_id" uuid REFERENCES "enrollments"("id"),
        "diagnostic_status_event_id" uuid REFERENCES "patient_diagnostic_status_events"("id"),
        "diagnosis" text NOT NULL,
        "occurred_on" date NOT NULL,
        "receives_treatment" boolean,
        "treatment_name" text,
        "medication" text,
        "treatment_frequency_value_min" numeric(10,2),
        "treatment_frequency_value_max" numeric(10,2),
        "treatment_frequency_unit" varchar(10),
        "treatment_frequency_label" varchar(120),
        "treatment_frequency_canonical_minutes_min" integer,
        "treatment_frequency_canonical_minutes_max" integer,
        "has_controls" boolean,
        "control_specialty" varchar(255),
        "control_periodicity_value_min" numeric(10,2),
        "control_periodicity_value_max" numeric(10,2),
        "control_periodicity_unit" varchar(10),
        "control_periodicity_label" varchar(120),
        "control_periodicity_canonical_minutes_min" integer,
        "control_periodicity_canonical_minutes_max" integer,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "discharged_on" date,
        "discharge_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_patient_non_oncological_follow_ups_status"
          CHECK ("status" IN ('ACTIVE', 'DISCHARGED'))
      )`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_non_oncological_follow_ups_patient_occurred"
       ON "patient_non_oncological_follow_ups" ("patient_id", "occurred_on" DESC, "id" DESC)`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_non_oncological_follow_ups_patient_status"
       ON "patient_non_oncological_follow_ups" ("patient_id", "status")`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_non_oncological_follow_ups_follow_up_id"
       ON "patient_non_oncological_follow_ups" ("follow_up_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_non_oncological_follow_ups_enrollment_id"
       ON "patient_non_oncological_follow_ups" ("enrollment_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DROP INDEX IF EXISTS "IDX_patient_non_oncological_follow_ups_enrollment_id"`,
    );
    await q.query(
      `DROP INDEX IF EXISTS "IDX_patient_non_oncological_follow_ups_follow_up_id"`,
    );
    await q.query(
      `DROP INDEX IF EXISTS "IDX_patient_non_oncological_follow_ups_patient_status"`,
    );
    await q.query(
      `DROP INDEX IF EXISTS "IDX_patient_non_oncological_follow_ups_patient_occurred"`,
    );
    await q.query(`DROP TABLE IF EXISTS "patient_non_oncological_follow_ups"`);
    await q.query(
      `ALTER TABLE "patient_symptom_reports"
       DROP COLUMN "is_awaiting_diagnosis",
       DROP COLUMN "next_consultation_date",
       DROP COLUMN "referral_not_provided_reason",
       DROP COLUMN "referred_health_center_id",
       DROP COLUMN "has_referral",
       DROP COLUMN "first_consultation_date",
       DROP COLUMN "no_medical_consultation_reason",
       DROP COLUMN "has_medical_consultation"`,
    );
  }
}
