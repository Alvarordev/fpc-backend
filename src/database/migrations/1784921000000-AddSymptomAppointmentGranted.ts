import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSymptomAppointmentGranted1784921000000
  implements MigrationInterface
{
  name = 'AddSymptomAppointmentGranted1784921000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_symptom_reports"
        ADD COLUMN IF NOT EXISTS "appointment_granted" boolean,
        ADD COLUMN IF NOT EXISTS "granted_appointment_date" date,
        ADD COLUMN IF NOT EXISTS "appointment_not_granted_reason" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_symptom_reports"
        DROP COLUMN IF EXISTS "appointment_not_granted_reason",
        DROP COLUMN IF EXISTS "granted_appointment_date",
        DROP COLUMN IF EXISTS "appointment_granted"
    `);
  }
}
