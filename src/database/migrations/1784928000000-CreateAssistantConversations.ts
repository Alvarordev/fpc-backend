import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssistantConversations1784928000000 implements MigrationInterface {
  name = 'CreateAssistantConversations1784928000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assistant_conversations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "title" varchar(200) NOT NULL,
        "pseudonyms" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assistant_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_assistant_conversations_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_assistant_conversations_user_id" ON "assistant_conversations" ("user_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "assistant_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversation_id" uuid NOT NULL,
        "role" varchar(20) NOT NULL,
        "content" text NOT NULL,
        "tool_calls" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "model" varchar(100),
        "input_tokens" integer,
        "output_tokens" integer,
        "error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assistant_messages" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_assistant_messages_role" CHECK ("role" IN ('USER', 'ASSISTANT')),
        CONSTRAINT "FK_assistant_messages_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "assistant_conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_assistant_messages_conversation_id" ON "assistant_messages" ("conversation_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assistant_messages"`);
    await queryRunner.query(`DROP TABLE "assistant_conversations"`);
  }
}
