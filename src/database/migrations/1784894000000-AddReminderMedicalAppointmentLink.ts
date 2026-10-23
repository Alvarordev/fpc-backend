import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReminderMedicalAppointmentLink1784894000000 implements MigrationInterface {
  name = 'AddReminderMedicalAppointmentLink1784894000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" ADD COLUMN "status" character varying(20) NOT NULL DEFAULT 'SCHEDULED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" ADD CONSTRAINT "CHK_patient_medical_appointments_status" CHECK ("status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_ANSWER'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" ADD COLUMN "reminder_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_medical_appointments_reminder_id" ON "patient_medical_appointments" ("reminder_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" ADD CONSTRAINT "FK_patient_medical_appointments_reminder_id" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "reminders" ADD COLUMN "kind" character varying(30) NOT NULL DEFAULT 'GENERIC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "CHK_reminders_kind" CHECK ("kind" IN ('GENERIC','MEDICAL_APPOINTMENT'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD COLUMN "medical_appointment_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_medical_appointment_id" ON "reminders" ("medical_appointment_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "FK_reminders_medical_appointment_id" FOREIGN KEY ("medical_appointment_id") REFERENCES "patient_medical_appointments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP CONSTRAINT "FK_reminders_medical_appointment_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reminders_medical_appointment_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP COLUMN "medical_appointment_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP CONSTRAINT "CHK_reminders_kind"`,
    );
    await queryRunner.query(`ALTER TABLE "reminders" DROP COLUMN "kind"`);

    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP CONSTRAINT "FK_patient_medical_appointments_reminder_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_patient_medical_appointments_reminder_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP COLUMN "reminder_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP CONSTRAINT "CHK_patient_medical_appointments_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP COLUMN "status"`,
    );
  }
}
