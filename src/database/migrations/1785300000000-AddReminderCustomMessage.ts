import { MigrationInterface, QueryRunner } from 'typeorm';

// Texto del recordatorio automático por correo escrito por el agente. Si está
// vacío se envía el texto sugerido que arma el sistema.
export class AddReminderCustomMessage1785300000000 implements MigrationInterface {
  name = 'AddReminderCustomMessage1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD "custom_message" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "psychooncology_appointments" ADD "reminder_custom_message" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "psychooncology_appointments" DROP COLUMN "reminder_custom_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP COLUMN "custom_message"`,
    );
  }
}
