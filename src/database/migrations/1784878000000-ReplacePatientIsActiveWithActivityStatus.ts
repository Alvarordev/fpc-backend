import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplacePatientIsActiveWithActivityStatus1784878000000 implements MigrationInterface {
  name = 'ReplacePatientIsActiveWithActivityStatus1784878000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN "activity_status" character varying(20)`,
    );
    await queryRunner.query(
      `UPDATE "patients" SET "activity_status" = CASE WHEN "is_active" = true THEN 'ACTIVE' ELSE 'INACTIVE' END`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "activity_status" SET DEFAULT 'ACTIVE', ALTER COLUMN "activity_status" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP CONSTRAINT "CHK_c0c20ad183431754a9b188ce9f"`,
    );
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "is_active"`);
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "CHK_patients_activity_status" CHECK ("activity_status" IN ('ACTIVE', 'INACTIVE', 'REACTIVE'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "CHK_patients_activity_deactivation" CHECK ((("activity_status" IN ('ACTIVE', 'REACTIVE') AND "deactivation_reason" IS NULL AND "deactivated_at" IS NULL AND "deactivation_reason_detail" IS NULL) OR ("activity_status" = 'INACTIVE' AND "deactivation_reason" IS NOT NULL AND "deactivated_at" IS NOT NULL AND (("deactivation_reason" = 'OTHER' AND "deactivation_reason_detail" IS NOT NULL) OR ("deactivation_reason" != 'OTHER' AND "deactivation_reason_detail" IS NULL))))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patients_activity_status" ON "patients" ("activity_status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_patients_activity_status"`);
    await queryRunner.query(
      `ALTER TABLE "patients" DROP CONSTRAINT "CHK_patients_activity_deactivation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP CONSTRAINT "CHK_patients_activity_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "patients" SET "is_active" = "activity_status" IN ('ACTIVE', 'REACTIVE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN "activity_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "CHK_c0c20ad183431754a9b188ce9f" CHECK ((("is_active" = true AND "deactivation_reason" IS NULL AND "deactivated_at" IS NULL AND "deactivation_reason_detail" IS NULL) OR ("is_active" = false AND "deactivation_reason" IS NOT NULL AND "deactivated_at" IS NOT NULL AND (("deactivation_reason" = 'OTHER' AND "deactivation_reason_detail" IS NOT NULL) OR ("deactivation_reason" != 'OTHER' AND "deactivation_reason_detail" IS NULL))))`,
    );
  }
}
