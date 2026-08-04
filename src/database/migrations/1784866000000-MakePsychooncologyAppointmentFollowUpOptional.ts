import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePsychooncologyAppointmentFollowUpOptional1784866000000
  implements MigrationInterface
{
  name = 'MakePsychooncologyAppointmentFollowUpOptional1784866000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "psychooncology_appointments" ALTER COLUMN "follow_up_id" DROP NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "psychooncology_appointments" ALTER COLUMN "follow_up_id" SET NOT NULL',
    );
  }
}
