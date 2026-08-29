import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientPsychooncologySupportAssessments1784887000000 implements MigrationInterface {
  name = 'AddPatientPsychooncologySupportAssessments1784887000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "patient_psychooncology_support_assessments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "follow_up_id" uuid NOT NULL REFERENCES "follow_ups"("id"), "excessive_worry" boolean, "emotional_distress_score" smallint, "preferred_modality" varchar(20), "created_at" timestamptz NOT NULL DEFAULT now(), CHECK ("emotional_distress_score" IS NULL OR "emotional_distress_score" BETWEEN 1 AND 10), CHECK ("preferred_modality" IS NULL OR "preferred_modality" IN ('CALL','VIDEO_CALL')))`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_psychooncology_support_assessments_patient_id" ON "patient_psychooncology_support_assessments" ("patient_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_psychooncology_support_assessments_follow_up_id" ON "patient_psychooncology_support_assessments" ("follow_up_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "patient_psychooncology_support_assessments"');
  }
}
