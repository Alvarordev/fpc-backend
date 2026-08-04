import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnrollmentWizardFields1784867000000 implements MigrationInterface {
  name = 'AddEnrollmentWizardFields1784867000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "enrollments" ADD COLUMN "case_comments" text, ADD COLUMN "call_started_at" timestamptz, ADD COLUMN "call_ended_at" timestamptz`,
    );
    await q.query(
      `ALTER TABLE "patient_details" ADD COLUMN "referred_to_social_worker" boolean`,
    );
    await q.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "has_discomfort" boolean, ADD COLUMN "signs_and_symptoms" text, ADD COLUMN "indications_received" text`,
    );
    await q.query(
      `CREATE TABLE "enrollment_family_talk_interests" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "enrollment_id" uuid NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE, "talk_name" varchar(255) NOT NULL, "family_member_name" varchar(255) NOT NULL, "family_member_phone" varchar(50), "family_member_email" varchar(255), "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE INDEX "IDX_enrollment_family_talk_interests_enrollment_id" ON "enrollment_family_talk_interests" ("enrollment_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "enrollment_family_talk_interests"`);
    await q.query(
      `ALTER TABLE "patient_symptom_reports" DROP COLUMN "indications_received", DROP COLUMN "signs_and_symptoms", DROP COLUMN "has_discomfort"`,
    );
    await q.query(
      `ALTER TABLE "patient_details" DROP COLUMN "referred_to_social_worker"`,
    );
    await q.query(
      `ALTER TABLE "enrollments" DROP COLUMN "call_ended_at", DROP COLUMN "call_started_at", DROP COLUMN "case_comments"`,
    );
  }
}
