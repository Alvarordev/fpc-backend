import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHistoricalEnrollmentCaptureFields1784900000000 implements MigrationInterface {
  name = 'AddHistoricalEnrollmentCaptureFields1784900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE "patients" ALTER COLUMN "primary_phone" DROP NOT NULL',
    );
    await q.query(
      'ALTER TABLE "enrollments" ADD COLUMN "not_attending_consultations_note" text, ADD COLUMN "not_receiving_treatment_reason" text',
    );
    await q.query(
      'ALTER TABLE "patient_diagnoses" ADD COLUMN "referred_health_center_id" uuid, ADD COLUMN "has_referral" boolean',
    );
    await q.query(
      'ALTER TABLE "patient_diagnoses" ADD CONSTRAINT "FK_patient_diagnoses_referred_health_center_id" FOREIGN KEY ("referred_health_center_id") REFERENCES "health_centers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await q.query(
      'CREATE INDEX "IDX_patient_diagnoses_referred_health_center_id" ON "patient_diagnoses" ("referred_health_center_id")',
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP INDEX IF EXISTS "IDX_patient_diagnoses_referred_health_center_id"',
    );
    await q.query(
      'ALTER TABLE "patient_diagnoses" DROP CONSTRAINT IF EXISTS "FK_patient_diagnoses_referred_health_center_id"',
    );
    await q.query(
      'ALTER TABLE "patient_diagnoses" DROP COLUMN "has_referral", DROP COLUMN "referred_health_center_id"',
    );
    await q.query(
      'ALTER TABLE "enrollments" DROP COLUMN "not_receiving_treatment_reason", DROP COLUMN "not_attending_consultations_note"',
    );
    await q.query(
      'ALTER TABLE "patients" ALTER COLUMN "primary_phone" SET NOT NULL',
    );
  }
}
