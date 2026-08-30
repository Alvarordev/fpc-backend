import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPsychooncologyAppointmentBeneficiary1784889000000 implements MigrationInterface {
  name = 'AddPsychooncologyAppointmentBeneficiary1784889000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD COLUMN "beneficiary_type" varchar(20) NOT NULL DEFAULT 'PATIENT'`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD COLUMN "companion_id" uuid`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD CONSTRAINT "FK_psychooncology_appointments_companion_id" FOREIGN KEY ("companion_id") REFERENCES "patients"("id")`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD CONSTRAINT "CHK_psychooncology_appointments_beneficiary" CHECK ("beneficiary_type" IN ('PATIENT','COMPANION') AND (("beneficiary_type" = 'PATIENT' AND "companion_id" IS NULL) OR ("beneficiary_type" = 'COMPANION' AND "companion_id" IS NOT NULL)))`,
    );
    await q.query(
      `CREATE INDEX "IDX_psychooncology_appointments_companion_id" ON "psychooncology_appointments" ("companion_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_psychooncology_appointments_companion_id"`);
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP CONSTRAINT "CHK_psychooncology_appointments_beneficiary"`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP CONSTRAINT "FK_psychooncology_appointments_companion_id"`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP COLUMN "companion_id"`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP COLUMN "beneficiary_type"`,
    );
  }
}
