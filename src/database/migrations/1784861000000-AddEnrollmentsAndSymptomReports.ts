import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnrollmentsAndSymptomReports1784861000000 implements MigrationInterface {
  name = 'AddEnrollmentsAndSymptomReports1784861000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "enrollments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "interaction_id" uuid NOT NULL REFERENCES "interactions"("id"), "affiliation_type" varchar(20) NOT NULL CHECK ("affiliation_type" IN ('SELF','FAMILY_FRIEND')), "companion_id" uuid REFERENCES "patients"("id"), "currently_attending_consultations" boolean, "currently_receiving_treatment" boolean, "entry_source" varchar(50), "entry_sub_source" varchar(50), "consent_to_contact" boolean, "consent_to_share_data" boolean, "requires_transportation" boolean, "has_mobility_issues" boolean, "is_oncological_patient" boolean NOT NULL DEFAULT false, "survey_accepted" boolean NOT NULL DEFAULT false, "interaction_quality_rating" smallint CHECK ("interaction_quality_rating" BETWEEN 1 AND 5), "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "patient_symptom_reports" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "interaction_id" uuid NOT NULL REFERENCES "interactions"("id"), "enrollment_id" uuid REFERENCES "enrollments"("id"), "discomfort_severity" varchar(20), "discomfort_description" text, "symptom_duration" varchar(50), "symptom_frequency" varchar(50), "is_pain_present" boolean, "pain_intensity" smallint CHECK ("pain_intensity" BETWEEN 0 AND 10), "pain_location" varchar(255), "pain_description" text, "has_sought_medical_consultation" boolean NOT NULL DEFAULT false, "health_center_id" uuid REFERENCES "health_centers"("id"), "specialty" varchar(255), "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    for (const [table, column] of [
      ['enrollments', 'patient_id'],
      ['enrollments', 'interaction_id'],
      ['enrollments', 'companion_id'],
      ['patient_symptom_reports', 'patient_id'],
      ['patient_symptom_reports', 'interaction_id'],
      ['patient_symptom_reports', 'enrollment_id'],
      ['patient_symptom_reports', 'health_center_id'],
    ] as const)
      await q.query(
        `CREATE INDEX "IDX_${table}_${column}" ON "${table}" ("${column}")`,
      );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "patient_symptom_reports"');
    await q.query('DROP TABLE "enrollments"');
  }
}
