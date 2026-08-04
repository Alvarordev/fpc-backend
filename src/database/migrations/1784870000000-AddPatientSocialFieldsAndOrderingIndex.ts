import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientSocialFieldsAndOrderingIndex1784870000000 implements MigrationInterface {
  name = 'AddPatientSocialFieldsAndOrderingIndex1784870000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "patient_details" ADD COLUMN "evidence_of_domestic_violence" boolean, ADD COLUMN "uses_wood_stove" boolean, ADD COLUMN "is_working" boolean, ADD COLUMN "receives_financial_support" boolean, ADD COLUMN "has_conadis_card" boolean, ADD COLUMN "knows_about_fissal" boolean, ADD COLUMN "program_dropout_reason" text, ADD COLUMN "program_dropout_date" date`,
    );
    await q.query(
      `CREATE INDEX "IDX_patients_created_at_id" ON "patients" ("created_at" DESC, "id" DESC)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_patients_created_at_id"`);
    await q.query(
      `ALTER TABLE "patient_details" DROP COLUMN "program_dropout_date", DROP COLUMN "program_dropout_reason", DROP COLUMN "knows_about_fissal", DROP COLUMN "has_conadis_card", DROP COLUMN "receives_financial_support", DROP COLUMN "is_working", DROP COLUMN "uses_wood_stove", DROP COLUMN "evidence_of_domestic_violence"`,
    );
  }
}
