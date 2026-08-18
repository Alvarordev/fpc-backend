import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientHealthPhases1784879000000 implements MigrationInterface {
  name = 'AddPatientHealthPhases1784879000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "health_phase" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_health_phase" CHECK ("health_phase" IS NULL OR "health_phase" IN ('CANCER_DIAGNOSIS', 'ANNUAL_CHECKUP', 'SIGNS_AND_SYMPTOMS'))`,
    );
    await queryRunner.query(
      `CREATE TABLE "patient_health_phase_history" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL, "health_phase" character varying(30) NOT NULL, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CHK_patient_health_phase_history_phase" CHECK ("health_phase" IN ('CANCER_DIAGNOSIS', 'ANNUAL_CHECKUP', 'SIGNS_AND_SYMPTOMS')), CONSTRAINT "PK_patient_health_phase_history" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_health_phase_history" ADD CONSTRAINT "FK_patient_health_phase_history_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_health_phase_history_patient_changed_at" ON "patient_health_phase_history" ("patient_id", "changed_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_patient_health_phase_history_patient_changed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_health_phase_history" DROP CONSTRAINT "FK_patient_health_phase_history_patient"`,
    );
    await queryRunner.query(`DROP TABLE "patient_health_phase_history"`);
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP CONSTRAINT "CHK_patient_details_health_phase"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "health_phase"`,
    );
  }
}
