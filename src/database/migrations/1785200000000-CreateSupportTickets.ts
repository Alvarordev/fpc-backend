import { MigrationInterface, QueryRunner } from 'typeorm';

// Tickets of change requests / bugs reported by foundation and agent users,
// with a conversation thread and per-side unread markers.
export class CreateSupportTickets1785200000000 implements MigrationInterface {
  name = 'CreateSupportTickets1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "support_tickets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticket_number" SERIAL NOT NULL,
        "type" varchar(32) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'PENDING',
        "title" varchar(160) NOT NULL,
        "description" text NOT NULL,
        "page_path" varchar(512),
        "reporter_activity_at" timestamptz,
        "reporter_seen_at" timestamptz,
        "admin_activity_at" timestamptz,
        "admin_seen_at" timestamptz,
        "created_by_id" uuid NOT NULL,
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_support_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_support_tickets_type" CHECK ("type" IN ('CHANGE_REQUEST','NEW_FEATURE','VISUAL_BUG','FUNCTIONAL_BUG','BLOCKING_BUG','QUESTION')),
        CONSTRAINT "CHK_support_tickets_status" CHECK ("status" IN ('PENDING','IN_REVIEW','NEEDS_MEETING','COMPLETED','DISMISSED')),
        CONSTRAINT "FK_support_tickets_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_support_tickets_ticket_number" ON "support_tickets" ("ticket_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_support_tickets_created_by_id" ON "support_tickets" ("created_by_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_support_tickets_status_created_at" ON "support_tickets" ("status", "created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE "support_ticket_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticket_id" uuid NOT NULL,
        "kind" varchar(16) NOT NULL,
        "body" text,
        "status" varchar(16),
        "author_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_support_ticket_messages" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_support_ticket_messages_kind" CHECK ("kind" IN ('COMMENT','STATUS_CHANGE')),
        CONSTRAINT "FK_support_ticket_messages_ticket" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_support_ticket_messages_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_support_ticket_messages_ticket_created_at" ON "support_ticket_messages" ("ticket_id", "created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE "support_ticket_attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticket_id" uuid NOT NULL,
        "message_id" uuid,
        "original_file_name" varchar(255) NOT NULL,
        "media_type" varchar(127) NOT NULL,
        "size_bytes" integer NOT NULL,
        "storage_key" varchar(512) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_support_ticket_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_support_ticket_attachments_ticket" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_support_ticket_attachments_message" FOREIGN KEY ("message_id") REFERENCES "support_ticket_messages"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_support_ticket_attachments_ticket_id" ON "support_ticket_attachments" ("ticket_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_support_ticket_attachments_storage_key" ON "support_ticket_attachments" ("storage_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "support_ticket_attachments"`);
    await queryRunner.query(`DROP TABLE "support_ticket_messages"`);
    await queryRunner.query(`DROP TABLE "support_tickets"`);
  }
}
