import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPsychooncologySessionFields1784888000000 implements MigrationInterface {
  name = 'AddPsychooncologySessionFields1784888000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD COLUMN "scheduling_notes" text`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD COLUMN "no_answer_note" text`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD COLUMN "satisfaction_rating" integer`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD COLUMN "satisfaction_comment" text`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD CONSTRAINT "CHK_psychooncology_appointments_satisfaction_rating" CHECK ("satisfaction_rating" IS NULL OR ("satisfaction_rating" >= 1 AND "satisfaction_rating" <= 5))`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP CONSTRAINT "CHK_psychooncology_appointments_satisfaction_rating"`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP COLUMN "satisfaction_comment"`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP COLUMN "satisfaction_rating"`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP COLUMN "no_answer_note"`,
    );
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP COLUMN "scheduling_notes"`,
    );
  }
}
