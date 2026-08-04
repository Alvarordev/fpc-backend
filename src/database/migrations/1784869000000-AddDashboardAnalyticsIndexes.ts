import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDashboardAnalyticsIndexes1784869000000 implements MigrationInterface {
  name = 'AddDashboardAnalyticsIndexes1784869000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX "IDX_enrollments_created_at" ON "enrollments" ("created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_psychooncology_appointments_scheduled_at" ON "psychooncology_appointments" ("scheduled_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_patient_medical_appointments_current_latest" ON "patient_medical_appointments" ("patient_id", "appointment_date" DESC, "created_at" DESC, "id" DESC) WHERE "is_current" = true',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_patient_medical_appointments_current_latest"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_psychooncology_appointments_scheduled_at"',
    );
    await queryRunner.query('DROP INDEX "IDX_enrollments_created_at"');
  }
}
