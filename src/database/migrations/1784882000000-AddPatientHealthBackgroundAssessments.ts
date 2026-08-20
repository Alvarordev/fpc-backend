import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientHealthBackgroundAssessments1784882000000 implements MigrationInterface {
  name = 'AddPatientHealthBackgroundAssessments1784882000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "patient_health_background_assessments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "follow_up_id" uuid NOT NULL REFERENCES "follow_ups"("id"), "has_psychiatry" boolean, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "patient_active_comorbidities" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "assessment_id" uuid NOT NULL REFERENCES "patient_health_background_assessments"("id"), "condition_name" varchar(255) NOT NULL, "treatment_description" text, "follow_up_specialty" varchar(255), "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "patient_limitations" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "assessment_id" uuid NOT NULL REFERENCES "patient_health_background_assessments"("id"), "description" text NOT NULL, "cause" varchar(30) NOT NULL CHECK ("cause" IN ('DIAGNOSIS','TREATMENT','NATURAL_CONDITION')), "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "patient_family_cancer_history" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "assessment_id" uuid NOT NULL REFERENCES "patient_health_background_assessments"("id"), "relationship" varchar(255) NOT NULL, "cancer_type" varchar(255), "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_health_background_assessments_patient_id" ON "patient_health_background_assessments" ("patient_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_health_background_assessments_follow_up_id" ON "patient_health_background_assessments" ("follow_up_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_active_comorbidities_assessment_id" ON "patient_active_comorbidities" ("assessment_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_limitations_assessment_id" ON "patient_limitations" ("assessment_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_family_cancer_history_assessment_id" ON "patient_family_cancer_history" ("assessment_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "patient_family_cancer_history"');
    await q.query('DROP TABLE "patient_limitations"');
    await q.query('DROP TABLE "patient_active_comorbidities"');
    await q.query('DROP TABLE "patient_health_background_assessments"');
  }
}
