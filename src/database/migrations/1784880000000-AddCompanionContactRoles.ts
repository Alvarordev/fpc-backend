import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanionContactRoles1784880000000 implements MigrationInterface {
  name = 'AddCompanionContactRoles1784880000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "companion_patient" ADD COLUMN "is_primary_contact" boolean NOT NULL DEFAULT false`,
    );
    await q.query(
      `ALTER TABLE "companion_patient" ADD COLUMN "is_caregiver" boolean NOT NULL DEFAULT false`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "companion_patient" DROP COLUMN "is_caregiver"`);
    await q.query(
      `ALTER TABLE "companion_patient" DROP COLUMN "is_primary_contact"`,
    );
  }
}
