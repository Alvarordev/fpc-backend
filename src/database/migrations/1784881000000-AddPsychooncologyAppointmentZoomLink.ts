import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPsychooncologyAppointmentZoomLink1784881000000 implements MigrationInterface {
  name = 'AddPsychooncologyAppointmentZoomLink1784881000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "psychooncology_appointments" ADD COLUMN "zoom_link" text`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "psychooncology_appointments" DROP COLUMN "zoom_link"`,
    );
  }
}
