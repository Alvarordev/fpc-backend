import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMedicalAppointmentTime1784873000000 implements MigrationInterface {
  name = 'AddMedicalAppointmentTime1784873000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "patient_medical_appointments" ADD COLUMN "appointment_time" time`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "patient_medical_appointments" DROP COLUMN "appointment_time"`,
    );
  }
}
