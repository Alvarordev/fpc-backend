import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNextAppointmentSpecialty1784886000000 implements MigrationInterface {
  name = 'AddNextAppointmentSpecialty1784886000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "patient_medical_appointments" ADD COLUMN "next_appointment_specialty" varchar(255)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "patient_medical_appointments" DROP COLUMN "next_appointment_specialty"',
    );
  }
}
