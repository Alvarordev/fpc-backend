import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerProfileFields1784890000000 implements MigrationInterface {
  name = 'AddVolunteerProfileFields1784890000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "volunteers" ADD COLUMN "birth_date" date`);
    await q.query(
      `ALTER TABLE "volunteers" ADD COLUMN "commitment_start_at" date`,
    );
    await q.query(
      `ALTER TABLE "volunteers" ADD COLUMN "commitment_end_at" date`,
    );
    await q.query(
      `ALTER TABLE "volunteers" ADD COLUMN "has_volunteer_certificate" boolean NOT NULL DEFAULT false`,
    );
    await q.query(
      `ALTER TABLE "volunteers" ADD COLUMN "additional_comments" text`,
    );
    await q.query(
      `ALTER TABLE "volunteers" ADD COLUMN "completed_sustainability_module" boolean NOT NULL DEFAULT false`,
    );
    await q.query(
      `ALTER TABLE "volunteers" ADD COLUMN "completed_design_thinking_module" boolean NOT NULL DEFAULT false`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "volunteers" DROP COLUMN "completed_design_thinking_module"`,
    );
    await q.query(
      `ALTER TABLE "volunteers" DROP COLUMN "completed_sustainability_module"`,
    );
    await q.query(`ALTER TABLE "volunteers" DROP COLUMN "additional_comments"`);
    await q.query(
      `ALTER TABLE "volunteers" DROP COLUMN "has_volunteer_certificate"`,
    );
    await q.query(`ALTER TABLE "volunteers" DROP COLUMN "commitment_end_at"`);
    await q.query(`ALTER TABLE "volunteers" DROP COLUMN "commitment_start_at"`);
    await q.query(`ALTER TABLE "volunteers" DROP COLUMN "birth_date"`);
  }
}
