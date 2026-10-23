import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHealthCentersInteractionsReminders1784855844614 implements MigrationInterface {
  name = 'AddHealthCentersInteractionsReminders1784855844614';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "health_centers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" varchar(255) NOT NULL, "slug" varchar(255) NOT NULL, "department" varchar(50) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "UQ_health_centers_slug" UNIQUE ("slug"), CONSTRAINT "CHK_health_centers_department" CHECK ("department" IN ('AMAZONAS','ANCASH','APURIMAC','AREQUIPA','AYACUCHO','CAJAMARCA','CALLAO','CUSCO','HUANCAVELICA','HUANUCO','ICA','JUNIN','LA_LIBERTAD','LAMBAYEQUE','LIMA','LORETO','MADRE_DE_DIOS','MOQUEGUA','PASCO','PIURA','PUNO','SAN_MARTIN','TACNA','TUMBES','UCAYALI')), CONSTRAINT "PK_health_centers" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "interactions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "subject_patient_id" uuid NOT NULL, "interlocutor_id" uuid NOT NULL, "agent_id" uuid, "type" varchar(20) NOT NULL, "status" varchar(20) NOT NULL, "purpose" varchar(30) NOT NULL, "scheduled_at" timestamptz, "completed_at" timestamptz, "notes" text, "next_interaction_id" uuid, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "CHK_interactions_type" CHECK ("type" IN ('WHATSAPP','CALL','VIDEO_CALL','EMAIL','IN_PERSON','FACEBOOK')), CONSTRAINT "CHK_interactions_status" CHECK ("status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_ANSWER')), CONSTRAINT "CHK_interactions_purpose" CHECK ("purpose" IN ('FIRST_CONTACT','ENROLLMENT','FOLLOW_UP','PSYCHOONCOLOGY_REFERRAL','OTHER')), CONSTRAINT "PK_interactions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reminders" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "subject_patient_id" uuid NOT NULL, "created_from_interaction_id" uuid, "assigned_agent_id" uuid, "due_at" timestamptz NOT NULL, "description" text NOT NULL, "status" varchar(20) NOT NULL DEFAULT 'PENDING', "completed_at" timestamptz, "resulting_interaction_id" uuid, "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "CHK_reminders_status" CHECK ("status" IN ('PENDING','DONE','DISMISSED')), CONSTRAINT "PK_reminders" PRIMARY KEY ("id"))`,
    );
    for (const [table, column] of [
      ['interactions', 'subject_patient_id'],
      ['interactions', 'interlocutor_id'],
      ['interactions', 'agent_id'],
      ['interactions', 'next_interaction_id'],
      ['interactions', 'status'],
      ['reminders', 'subject_patient_id'],
      ['reminders', 'created_from_interaction_id'],
      ['reminders', 'assigned_agent_id'],
      ['reminders', 'resulting_interaction_id'],
      ['reminders', 'status'],
      ['reminders', 'due_at'],
    ] as const)
      await queryRunner.query(
        `CREATE INDEX "IDX_${table}_${column}" ON "${table}" ("${column}")`,
      );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD CONSTRAINT "FK_interactions_subject" FOREIGN KEY ("subject_patient_id") REFERENCES "patients"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD CONSTRAINT "FK_interactions_interlocutor" FOREIGN KEY ("interlocutor_id") REFERENCES "patients"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD CONSTRAINT "FK_interactions_agent" FOREIGN KEY ("agent_id") REFERENCES "agents"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD CONSTRAINT "FK_interactions_next" FOREIGN KEY ("next_interaction_id") REFERENCES "interactions"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "FK_reminders_subject" FOREIGN KEY ("subject_patient_id") REFERENCES "patients"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "FK_reminders_created" FOREIGN KEY ("created_from_interaction_id") REFERENCES "interactions"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "FK_reminders_agent" FOREIGN KEY ("assigned_agent_id") REFERENCES "agents"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "FK_reminders_resulting" FOREIGN KEY ("resulting_interaction_id") REFERENCES "interactions"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "primary_health_center_id" uuid REFERENCES "health_centers"("id")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "primary_health_center_id"`,
    );
    await queryRunner.query('DROP TABLE "reminders"');
    await queryRunner.query('DROP TABLE "interactions"');
    await queryRunner.query('DROP TABLE "health_centers"');
  }
}
