import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientHealthSubcategories1784891000000 implements MigrationInterface {
  name = 'AddPatientHealthSubcategories1784891000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "health_subcategory" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_health_subcategory" CHECK ("health_subcategory" IS NULL OR "health_subcategory" IN ('SIGNS_AND_SYMPTOMS_PATIENT', 'ACTIVE_TREATMENT', 'UNDER_CONTROLS', 'TREATMENT_ABANDONED', 'PALLIATIVE_NO_ACTIVE_TREATMENT', 'CANCER_RULED_OUT'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_details_health_phase" ON "patient_details" ("health_phase")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_details_health_subcategory" ON "patient_details" ("health_subcategory")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_patient_details_health_subcategory"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_patient_details_health_phase"`);
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP CONSTRAINT "CHK_patient_details_health_subcategory"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "health_subcategory"`,
    );
  }
}
