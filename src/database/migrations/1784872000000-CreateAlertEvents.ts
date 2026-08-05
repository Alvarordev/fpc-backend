import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAlertEvents1784872000000 implements MigrationInterface {
  name = 'CreateAlertEvents1784872000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "alert_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "alert_id" uuid NOT NULL REFERENCES "alerts"("id") ON DELETE CASCADE,
        "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
        "event_type" varchar(50) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_alert_events_event_type" CHECK ("event_type" IN ('CREATED','STATUS_CHANGED','DERIVED','COMMENT','AI_SUMMARY_GENERATED','RESOLVED'))
      )
    `);
    await q.query(
      `CREATE INDEX "IDX_alert_events_alert_id" ON "alert_events" ("alert_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_alert_events_alert_id_created_at" ON "alert_events" ("alert_id", "created_at")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_alert_events_alert_id_created_at"`);
    await q.query(`DROP INDEX "IDX_alert_events_alert_id"`);
    await q.query(`DROP TABLE "alert_events"`);
  }
}
