import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeLibrary1785100800000 implements MigrationInterface {
  name = 'CreateKnowledgeLibrary1785100800000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE knowledge_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(200) NOT NULL, version varchar(50) NOT NULL,
      original_name varchar(240) NOT NULL, media_type varchar(100) NOT NULL, size integer NOT NULL CHECK (size > 0 AND size <= 10485760), content bytea NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
      index_status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (index_status IN ('PENDING','PROCESSING','READY','FAILED')),
      store_name text, operation_name text, remote_name text, index_error text, index_started_at timestamptz,
      uploaded_by uuid NOT NULL REFERENCES users(id), updated_by uuid NOT NULL REFERENCES users(id), published_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_documents_publication" ON knowledge_documents(status, index_status)`,
    );
    await queryRunner.query(
      `CREATE TABLE knowledge_search_settings (id integer PRIMARY KEY CHECK (id=1), store_name text NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE assistant_conversations ADD COLUMN mode varchar(20) NOT NULL DEFAULT 'DATA' CHECK (mode IN ('DATA','DOCUMENTS'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assistant_conversations_user_mode" ON assistant_conversations(user_id,mode,updated_at DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE assistant_messages ADD COLUMN citations jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN unanswered boolean NOT NULL DEFAULT false`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE assistant_messages DROP COLUMN unanswered, DROP COLUMN citations`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_assistant_conversations_user_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE assistant_conversations DROP COLUMN mode`,
    );
    await queryRunner.query(`DROP TABLE knowledge_search_settings`);
    await queryRunner.query(`DROP TABLE knowledge_documents`);
  }
}
