import { MigrationInterface, QueryRunner } from 'typeorm';

// Psycho-oncology sessions: new statuses (NO_SHOW, RESCHEDULED, OVERDUE),
// care cycles, rescheduling links, own reminder, reassignment and no-show
// management; recurring availability blocks.
export class PsychooncologySessionLifecycle1784924000000 implements MigrationInterface {
  name = 'PsychooncologySessionLifecycle1784924000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "psychooncology_cycles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL,
        "opened_at" timestamptz NOT NULL,
        "closed_at" timestamptz,
        "close_reason" varchar(20),
        "closed_by_id" uuid,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_psychooncology_cycles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_psychooncology_cycles_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_psychooncology_cycles_closed_by" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_psychooncology_cycles_close_reason" CHECK ("close_reason" IS NULL OR "close_reason" IN ('COMPLETED','ABANDONED','NOT_NEEDED')),
        CONSTRAINT "CHK_psychooncology_cycles_closed" CHECK (("closed_at" IS NULL) = ("close_reason" IS NULL))
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_psychooncology_cycles_patient_id" ON "psychooncology_cycles" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_psychooncology_cycles_open_patient" ON "psychooncology_cycles" ("patient_id") WHERE "closed_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "audit_psychooncology_cycles" AFTER INSERT OR UPDATE OR DELETE ON "psychooncology_cycles" FOR EACH ROW EXECUTE FUNCTION audit_row_change('patient_id')`,
    );

    await queryRunner.query(
      `ALTER TABLE "psychooncology_appointments" DROP CONSTRAINT "psychooncology_appointments_status_check"`,
    );
    await queryRunner.query(
      `UPDATE "psychooncology_appointments" SET "status" = 'NO_SHOW' WHERE "status" = 'NO_ANSWER'`,
    );
    await queryRunner.query(
      `ALTER TABLE "psychooncology_appointments" ADD CONSTRAINT "psychooncology_appointments_status_check" CHECK ("status" IN ('SCHEDULED','COMPLETED','NO_SHOW','CANCELLED','RESCHEDULED','OVERDUE'))`,
    );
    await queryRunner.query(`
      ALTER TABLE "psychooncology_appointments"
        ADD COLUMN "cycle_id" uuid,
        ADD COLUMN "rescheduled_to_id" uuid,
        ADD COLUMN "needs_reassignment" boolean NOT NULL DEFAULT false,
        ADD COLUMN "reminder_mode" varchar(20) NOT NULL DEFAULT 'MANUAL',
        ADD COLUMN "remind_at" timestamptz,
        ADD COLUMN "reminder_sent_at" timestamptz,
        ADD COLUMN "no_show_managed_at" timestamptz,
        ADD COLUMN "no_show_managed_by_id" uuid,
        ADD CONSTRAINT "FK_psychooncology_appointments_cycle" FOREIGN KEY ("cycle_id") REFERENCES "psychooncology_cycles"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_psychooncology_appointments_rescheduled_to" FOREIGN KEY ("rescheduled_to_id") REFERENCES "psychooncology_appointments"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_psychooncology_appointments_no_show_managed_by" FOREIGN KEY ("no_show_managed_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "CHK_psychooncology_appointments_reminder_mode" CHECK ("reminder_mode" IN ('TWO_HOURS','ONE_DAY','CUSTOM','MANUAL'))`);
    await queryRunner.query(
      `CREATE INDEX "IDX_psychooncology_appointments_cycle_id" ON "psychooncology_appointments" ("cycle_id")`,
    );

    // Patients with pending sessions get an open cycle holding them.
    await queryRunner.query(`
      INSERT INTO "psychooncology_cycles" ("patient_id", "opened_at")
      SELECT "patient_id", MIN("created_at")
        FROM "psychooncology_appointments"
       WHERE "status" = 'SCHEDULED' AND "is_historical" = false
       GROUP BY "patient_id"`);
    await queryRunner.query(`
      UPDATE "psychooncology_appointments" a
         SET "cycle_id" = c."id"
        FROM "psychooncology_cycles" c
       WHERE c."patient_id" = a."patient_id"
         AND c."closed_at" IS NULL
         AND a."is_historical" = false`);

    await queryRunner.query(
      `ALTER TABLE "volunteer_availability" ADD COLUMN "recurrence_id" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteer_availability" DROP COLUMN "recurrence_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "psychooncology_appointments"
        DROP CONSTRAINT "CHK_psychooncology_appointments_reminder_mode",
        DROP COLUMN "no_show_managed_by_id",
        DROP COLUMN "no_show_managed_at",
        DROP COLUMN "reminder_sent_at",
        DROP COLUMN "remind_at",
        DROP COLUMN "reminder_mode",
        DROP COLUMN "needs_reassignment",
        DROP COLUMN "rescheduled_to_id",
        DROP COLUMN "cycle_id"`);
    await queryRunner.query(
      `ALTER TABLE "psychooncology_appointments" DROP CONSTRAINT "psychooncology_appointments_status_check"`,
    );
    await queryRunner.query(`
      UPDATE "psychooncology_appointments"
         SET "status" = CASE "status"
           WHEN 'NO_SHOW' THEN 'NO_ANSWER'
           WHEN 'RESCHEDULED' THEN 'CANCELLED'
           WHEN 'OVERDUE' THEN 'SCHEDULED'
           ELSE "status" END`);
    await queryRunner.query(
      `ALTER TABLE "psychooncology_appointments" ADD CONSTRAINT "psychooncology_appointments_status_check" CHECK ("status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_ANSWER'))`,
    );
    await queryRunner.query('DROP TABLE "psychooncology_cycles"');
  }
}
