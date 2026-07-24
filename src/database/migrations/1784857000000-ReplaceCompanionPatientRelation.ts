import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceCompanionPatientRelation1784857000000 implements MigrationInterface {
  name = 'ReplaceCompanionPatientRelation1784857000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "companion_patient" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "companion_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "is_primary_informant" boolean NOT NULL DEFAULT false, "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "UQ_companion_patient" UNIQUE ("companion_id", "patient_id"), CONSTRAINT "PK_companion_patient" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_companion_patient_companion_id" ON "companion_patient" ("companion_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_companion_patient_patient_id" ON "companion_patient" ("patient_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "companion_patient" ADD CONSTRAINT "FK_companion_patient_companion" FOREIGN KEY ("companion_id") REFERENCES "patients"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "companion_patient" ADD CONSTRAINT "FK_companion_patient_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id")`,
    );
    await queryRunner.query(
      `INSERT INTO "companion_patient" ("companion_id", "patient_id", "is_primary_informant", "created_at") SELECT "id", "accompanies_patient_id", "is_primary_informant", "created_at" FROM "patients" WHERE "accompanies_patient_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP CONSTRAINT "CHK_f858527aed1001bc4d4ec75cec"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_patients_accompanies_patient_id"`);
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN "accompanies_patient_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN "is_primary_informant"`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD "accompanies_patient_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD "is_primary_informant" boolean NOT NULL DEFAULT false`,
    );
    // Lossy rollback: only the oldest relationship can be represented by the prior 1:N model.
    await queryRunner.query(
      `UPDATE "patients" p SET "accompanies_patient_id" = source."patient_id", "is_primary_informant" = source."is_primary_informant" FROM (SELECT DISTINCT ON ("companion_id") "companion_id", "patient_id", "is_primary_informant" FROM "companion_patient" ORDER BY "companion_id", "created_at") source WHERE p."id" = source."companion_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "CHK_f858527aed1001bc4d4ec75cec" CHECK ("role" != 'COMPANION' OR "accompanies_patient_id" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patients_accompanies_patient_id" ON "patients" ("accompanies_patient_id")`,
    );
    await queryRunner.query(`DROP TABLE "companion_patient"`);
  }
}
