import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlertTriageFields1784871000000 implements MigrationInterface {
  name = 'AddAlertTriageFields1784871000000';

  async up(q: QueryRunner): Promise<void> {
    // Never reset this sequence: ticket_number is unique and the year prefix
    // is derived at write time, so resetting would eventually collide.
    await q.query(
      `CREATE SEQUENCE "alert_ticket_seq" START WITH 1001 INCREMENT BY 1`,
    );
    await q.query(
      `ALTER TABLE "alerts" ADD COLUMN "ticket_number" varchar(30), ADD COLUMN "severity" varchar(20) NOT NULL DEFAULT 'HIGH', ADD COLUMN "category" varchar(50) NOT NULL DEFAULT 'GENERAL', ADD COLUMN "ai_summary" text, ADD COLUMN "under_review" boolean NOT NULL DEFAULT false, ADD COLUMN "derived_to" varchar(50), ADD COLUMN "derivation_notes" text`,
    );
    // Backfill existing rows with the year of their own created_at, oldest first.
    await q.query(`
      UPDATE "alerts" a SET "ticket_number" =
        'ALT-' || to_char(a."created_at", 'YYYY') || '-' || o.seq
      FROM (
        SELECT id, nextval('alert_ticket_seq') AS seq
        FROM (SELECT id FROM "alerts" ORDER BY "created_at", "id") s
      ) o
      WHERE o.id = a.id;
    `);
    await q.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "CHK_alerts_severity" CHECK ("severity" IN ('HIGH','MEDIUM','LOW'))`,
    );
    await q.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "CHK_alerts_category" CHECK ("category" IN ('GENERAL','MEDICATION_SHORTAGE','APPOINTMENT_DELAY','INSURANCE_COVERAGE','TRANSPORT','ADMINISTRATIVE','PSYCHOSOCIAL','OTHER'))`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_alerts_ticket_number" ON "alerts" ("ticket_number")`,
    );
    await q.query(
      `CREATE INDEX "IDX_alerts_severity" ON "alerts" ("severity")`,
    );
    await q.query(
      `CREATE INDEX "IDX_alerts_category" ON "alerts" ("category")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_alerts_category"`);
    await q.query(`DROP INDEX "IDX_alerts_severity"`);
    await q.query(`DROP INDEX "UQ_alerts_ticket_number"`);
    await q.query(`ALTER TABLE "alerts" DROP CONSTRAINT "CHK_alerts_category"`);
    await q.query(`ALTER TABLE "alerts" DROP CONSTRAINT "CHK_alerts_severity"`);
    await q.query(
      `ALTER TABLE "alerts" DROP COLUMN "derivation_notes", DROP COLUMN "derived_to", DROP COLUMN "under_review", DROP COLUMN "ai_summary", DROP COLUMN "category", DROP COLUMN "severity", DROP COLUMN "ticket_number"`,
    );
    await q.query(`DROP SEQUENCE "alert_ticket_seq"`);
  }
}
