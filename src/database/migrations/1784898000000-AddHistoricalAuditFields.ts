import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHistoricalAuditFields1784898000000 implements MigrationInterface {
  name = 'AddHistoricalAuditFields1784898000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'enrollments',
      'reminders',
      'patient_medical_appointments',
      'volunteer_availability',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now()`,
      );
    }

    for (const table of [
      'enrollments',
      'follow_ups',
      'reminders',
      'patient_medical_appointments',
      'psychooncology_appointments',
      'volunteer_availability',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "historical_loaded_by_id" uuid`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_historical_loaded_by_id" FOREIGN KEY ("historical_loaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_${table}_historical_loaded_by_id" ON "${table}" ("historical_loaded_by_id")`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'volunteer_availability',
      'psychooncology_appointments',
      'patient_medical_appointments',
      'reminders',
      'follow_ups',
      'enrollments',
    ]) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_${table}_historical_loaded_by_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "FK_${table}_historical_loaded_by_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "historical_loaded_by_id"`,
      );
    }

    for (const table of [
      'volunteer_availability',
      'patient_medical_appointments',
      'reminders',
      'enrollments',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "updated_at"`,
      );
    }
  }
}
