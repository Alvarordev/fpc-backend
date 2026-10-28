import { MigrationInterface, QueryRunner } from 'typeorm';
import { ALERT_CATALOG_SEEDS } from '../../modules/alerts/alert-catalog-seeds';

// Reminders become informative (no resulting follow-up) with channel, lead
// and delivery state. Alerts get REPORTED/IN_REVIEW/RESOLVED, N patient
// reports, catalog category/derivation and a single resolver column.
export class RedefineRemindersAndAlerts1784923000000 implements MigrationInterface {
  name = 'RedefineRemindersAndAlerts1784923000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Reminders
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP CONSTRAINT "FK_reminders_resulting"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_reminders_resulting_follow_up_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP COLUMN "resulting_follow_up_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "reminders"
        ADD COLUMN "channel" character varying(20) NOT NULL DEFAULT 'MANUAL',
        ADD COLUMN "lead" character varying(20),
        ADD COLUMN "remind_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "delivery_status" character varying(20) NOT NULL DEFAULT 'PENDING',
        ADD COLUMN "sent_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "delivery_error" text,
        ADD CONSTRAINT "CHK_reminders_channel" CHECK ("channel" IN ('EMAIL','MANUAL')),
        ADD CONSTRAINT "CHK_reminders_lead" CHECK ("lead" IS NULL OR "lead" IN ('TWO_HOURS','ONE_DAY','CUSTOM')),
        ADD CONSTRAINT "CHK_reminders_delivery_status" CHECK ("delivery_status" IN ('PENDING','SENT','FAILED'))
    `);
    await queryRunner.query(`
      UPDATE "reminders"
         SET "lead" = CASE WHEN "kind" = 'MEDICAL_APPOINTMENT' THEN 'ONE_DAY' END,
             "remind_at" = CASE
               WHEN "kind" = 'MEDICAL_APPOINTMENT' THEN "due_at" - interval '1 day'
               ELSE "due_at"
             END
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_delivery_queue" ON "reminders" ("channel", "delivery_status", "remind_at")`,
    );

    // Alert catalogs
    for (const item of ALERT_CATALOG_SEEDS) {
      await queryRunner.query(
        `INSERT INTO catalog_items (kind, code, label, sort_order, is_active, is_system)
         VALUES ($1, $2, $3, $4, true, true)
         ON CONFLICT (kind, code) DO UPDATE SET
           label = EXCLUDED.label,
           sort_order = EXCLUDED.sort_order,
           is_active = true,
           is_system = true,
           updated_at = now()`,
        [item.kind, item.code, item.label, item.sortOrder],
      );
    }

    // Alerts: status
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "alerts_status_check"`,
    );
    await queryRunner.query(`
      UPDATE "alerts" SET "status" = CASE
        WHEN "status" = 'RESOLVED' THEN 'RESOLVED'
        WHEN "under_review" THEN 'IN_REVIEW'
        ELSE 'REPORTED'
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "alerts"
        ALTER COLUMN "status" SET DEFAULT 'REPORTED',
        ADD CONSTRAINT "CHK_alerts_status" CHECK ("status" IN ('REPORTED','IN_REVIEW','RESOLVED')),
        DROP COLUMN "under_review"
    `);

    // Alerts: category from catalog, without OTHER
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "CHK_alerts_category"`,
    );
    await queryRunner.query(
      `UPDATE "alerts" SET "category" = 'GENERAL' WHERE "category" = 'OTHER'`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ALTER COLUMN "category" TYPE character varying(100)`,
    );

    // Alerts: single resolver (user)
    await queryRunner.query(`
      UPDATE "alerts" a SET "resolved_by_user_id" = ag."user_id"
        FROM "agents" ag
       WHERE a."resolved_by_user_id" IS NULL AND ag."id" = a."resolved_by_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "alerts_resolved_by_id_fkey"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_alerts_resolved_by_id"`);
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "resolved_by_id"`,
    );

    // Alerts: resolution and derivation details
    await queryRunner.query(`
      ALTER TABLE "alerts"
        ADD COLUMN "resolution_notes" text,
        ADD COLUMN "derived_at" TIMESTAMP WITH TIME ZONE,
        ALTER COLUMN "derived_to" TYPE character varying(100)
    `);
    await queryRunner.query(
      `UPDATE "alerts" SET "derived_at" = "updated_at" WHERE "derived_to" IS NOT NULL`,
    );

    // Alert events: actor user and new types
    await queryRunner.query(
      `ALTER TABLE "alert_events" DROP CONSTRAINT "CHK_alert_events_event_type"`,
    );
    await queryRunner.query(`
      ALTER TABLE "alert_events"
        ADD COLUMN "actor_user_id" uuid,
        ADD CONSTRAINT "FK_alert_events_actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "CHK_alert_events_event_type" CHECK ("event_type" IN ('CREATED','STATUS_CHANGED','DERIVED','COMMENT','AI_SUMMARY_GENERATED','RESOLVED','REPORT_LINKED','PATIENTS_NOTIFIED'))
    `);
    await queryRunner.query(`
      UPDATE "alert_events" e SET "actor_user_id" = ag."user_id"
        FROM "agents" ag WHERE ag."id" = e."agent_id"
    `);

    // Alert reports (one alert, many patients/follow-ups)
    await queryRunner.query(`
      CREATE TABLE "alert_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "alert_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "follow_up_id" uuid NOT NULL,
        "reported_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "reported_by_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_alert_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_alert_reports_alert_id" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_alert_reports_patient_id" FOREIGN KEY ("patient_id") REFERENCES "patients"("id"),
        CONSTRAINT "FK_alert_reports_follow_up_id" FOREIGN KEY ("follow_up_id") REFERENCES "follow_ups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_alert_reports_reported_by_user_id" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_alert_reports_alert_follow_up" ON "alert_reports" ("alert_id", "follow_up_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_alert_reports_patient_id" ON "alert_reports" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_alert_reports_follow_up_id" ON "alert_reports" ("follow_up_id")`,
    );
    await queryRunner.query(`
      INSERT INTO "alert_reports" ("alert_id", "patient_id", "follow_up_id", "reported_at", "reported_by_user_id", "created_at")
      SELECT a."id", f."subject_patient_id", a."follow_up_id", a."created_at", ag."user_id", a."created_at"
        FROM "alerts" a
        JOIN "follow_ups" f ON f."id" = a."follow_up_id"
        LEFT JOIN "agents" ag ON ag."id" = a."created_by_id"
    `);
    await queryRunner.query(
      `CREATE TRIGGER "audit_alert_reports" AFTER INSERT OR UPDATE OR DELETE ON "alert_reports"
       FOR EACH ROW EXECUTE FUNCTION audit_row_change('patient_id')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "audit_alert_reports" ON "alert_reports"`,
    );
    await queryRunner.query(`DROP TABLE "alert_reports"`);

    await queryRunner.query(
      `DELETE FROM "alert_events" WHERE "event_type" IN ('REPORT_LINKED','PATIENTS_NOTIFIED')`,
    );
    await queryRunner.query(`
      ALTER TABLE "alert_events"
        DROP CONSTRAINT "CHK_alert_events_event_type",
        DROP CONSTRAINT "FK_alert_events_actor_user_id",
        DROP COLUMN "actor_user_id",
        ADD CONSTRAINT "CHK_alert_events_event_type" CHECK ("event_type" IN ('CREATED','STATUS_CHANGED','DERIVED','COMMENT','AI_SUMMARY_GENERATED','RESOLVED'))
    `);

    await queryRunner.query(`
      ALTER TABLE "alerts"
        DROP COLUMN "derived_at",
        DROP COLUMN "resolution_notes",
        ADD COLUMN "resolved_by_id" uuid,
        ADD COLUMN "under_review" boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT "alerts_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "agents"("id")
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_alerts_resolved_by_id" ON "alerts" ("resolved_by_id")`,
    );
    await queryRunner.query(`
      UPDATE "alerts" a SET "resolved_by_id" = ag."id"
        FROM "agents" ag WHERE ag."user_id" = a."resolved_by_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "alerts"
        DROP CONSTRAINT "CHK_alerts_status",
        ALTER COLUMN "status" SET DEFAULT 'ACTIVE'
    `);
    await queryRunner.query(`
      UPDATE "alerts" SET
        "under_review" = ("status" = 'IN_REVIEW'),
        "status" = CASE WHEN "status" = 'RESOLVED' THEN 'RESOLVED' ELSE 'ACTIVE' END
    `);
    await queryRunner.query(`
      UPDATE "alerts" SET "category" = 'OTHER'
       WHERE "category" NOT IN ('GENERAL','MEDICATION_SHORTAGE','APPOINTMENT_DELAY','INSURANCE_COVERAGE','TRANSPORT','ADMINISTRATIVE','PSYCHOSOCIAL')
    `);
    await queryRunner.query(`
      ALTER TABLE "alerts"
        ALTER COLUMN "category" TYPE character varying(50),
        ADD CONSTRAINT "alerts_status_check" CHECK ("status" IN ('ACTIVE','RESOLVED')),
        ADD CONSTRAINT "CHK_alerts_category" CHECK ("category" IN ('GENERAL','MEDICATION_SHORTAGE','APPOINTMENT_DELAY','INSURANCE_COVERAGE','TRANSPORT','ADMINISTRATIVE','PSYCHOSOCIAL','OTHER'))
    `);
    await queryRunner.query(
      `DELETE FROM catalog_items WHERE kind IN ('alert_category', 'alert_derivation_entity')`,
    );

    await queryRunner.query(`DROP INDEX "IDX_reminders_delivery_queue"`);
    await queryRunner.query(`
      ALTER TABLE "reminders"
        DROP CONSTRAINT "CHK_reminders_delivery_status",
        DROP CONSTRAINT "CHK_reminders_lead",
        DROP CONSTRAINT "CHK_reminders_channel",
        DROP COLUMN "delivery_error",
        DROP COLUMN "sent_at",
        DROP COLUMN "delivery_status",
        DROP COLUMN "remind_at",
        DROP COLUMN "lead",
        DROP COLUMN "channel",
        ADD COLUMN "resulting_follow_up_id" uuid,
        ADD CONSTRAINT "FK_reminders_resulting" FOREIGN KEY ("resulting_follow_up_id") REFERENCES "follow_ups"("id")
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_resulting_follow_up_id" ON "reminders" ("resulting_follow_up_id")`,
    );
  }
}
