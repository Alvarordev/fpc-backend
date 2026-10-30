import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Follow-up attempts (S5) and the OVERDUE status (S6). Existing COMPLETED and
 * NO_ANSWER follow-ups get the single attempt they implied; the backfill is
 * not written to change_log (it is not a change made by anyone).
 */
export class AddFollowUpAttemptsAndOverdue1784921000000 implements MigrationInterface {
  name = 'AddFollowUpAttemptsAndOverdue1784921000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "follow_ups" DROP CONSTRAINT "CHK_follow_ups_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow_ups" ADD CONSTRAINT "CHK_follow_ups_status" CHECK ("status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_ANSWER','OVERDUE'))`,
    );
    await queryRunner.query(`
      CREATE TABLE "follow_up_attempts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "follow_up_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "outcome" varchar(20) NOT NULL,
        "occurred_at" timestamptz NOT NULL,
        "actor_user_id" uuid,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follow_up_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_follow_up_attempts_follow_up" FOREIGN KEY ("follow_up_id")
          REFERENCES "follow_ups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_follow_up_attempts_patient" FOREIGN KEY ("patient_id")
          REFERENCES "patients"("id"),
        CONSTRAINT "FK_follow_up_attempts_actor_user" FOREIGN KEY ("actor_user_id")
          REFERENCES "users"("id"),
        CONSTRAINT "CHK_follow_up_attempts_channel" CHECK ("channel" IN ('WHATSAPP','CALL','VIDEO_CALL','EMAIL','IN_PERSON','FACEBOOK')),
        CONSTRAINT "CHK_follow_up_attempts_outcome" CHECK ("outcome" IN ('CONTACTED','NO_ANSWER','WRONG_NUMBER','REJECTED'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_follow_up_attempts_follow_up_id" ON "follow_up_attempts" ("follow_up_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_follow_up_attempts_patient_id" ON "follow_up_attempts" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "audit_follow_up_attempts" AFTER INSERT OR UPDATE OR DELETE ON "follow_up_attempts" FOR EACH ROW EXECUTE FUNCTION audit_row_change('patient_id')`,
    );

    await queryRunner.query(
      `SELECT set_config('app.audit', '{"suppress":"on"}', true)`,
    );
    await queryRunner.query(`
      INSERT INTO "follow_up_attempts" (
        follow_up_id, patient_id, channel, outcome, occurred_at, actor_user_id, created_at
      )
      SELECT
        follow_up.id, follow_up.subject_patient_id, follow_up.type,
        CASE follow_up.status WHEN 'COMPLETED' THEN 'CONTACTED' ELSE 'NO_ANSWER' END,
        COALESCE(
          follow_up.completed_at,
          follow_up.completed_on::timestamp AT TIME ZONE 'America/Lima',
          follow_up.scheduled_at,
          follow_up.updated_at
        ),
        agent.user_id, follow_up.created_at
      FROM "follow_ups" follow_up
      LEFT JOIN "agents" agent ON agent.id = follow_up.agent_id
      WHERE follow_up.status IN ('COMPLETED', 'NO_ANSWER')
    `);
    await queryRunner.query(`SELECT set_config('app.audit', '', true)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "follow_up_attempts"`);
    await queryRunner.query(
      `UPDATE "follow_ups" SET "status" = 'SCHEDULED' WHERE "status" = 'OVERDUE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow_ups" DROP CONSTRAINT "CHK_follow_ups_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow_ups" ADD CONSTRAINT "CHK_follow_ups_status" CHECK ("status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_ANSWER'))`,
    );
  }
}
