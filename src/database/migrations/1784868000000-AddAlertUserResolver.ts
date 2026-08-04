import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlertUserResolver1784868000000 implements MigrationInterface {
  name = 'AddAlertUserResolver1784868000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE "alerts" ADD COLUMN "resolved_by_user_id" uuid REFERENCES "users"("id")',
    );
    await q.query(
      'CREATE INDEX "IDX_alerts_resolved_by_user_id" ON "alerts" ("resolved_by_user_id")',
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX "IDX_alerts_resolved_by_user_id"');
    await q.query('ALTER TABLE "alerts" DROP COLUMN "resolved_by_user_id"');
  }
}
