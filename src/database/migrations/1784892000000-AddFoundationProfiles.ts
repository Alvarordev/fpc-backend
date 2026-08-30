import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFoundationProfiles1784892000000 implements MigrationInterface {
  name = 'AddFoundationProfiles1784892000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "foundations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "first_name" character varying(255) NOT NULL,
        "last_name" character varying(255) NOT NULL,
        "phone" character varying(50) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_foundations_user_id" UNIQUE ("user_id"),
        CONSTRAINT "PK_foundations_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "foundations" ADD CONSTRAINT "FK_foundations_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `INSERT INTO "foundations" ("user_id", "first_name", "last_name", "phone")
       SELECT
         u.id,
         COALESCE(NULLIF(split_part(split_part(u.email, '@', 1), '.', 1), ''), 'Equipo'),
         COALESCE(NULLIF(split_part(split_part(u.email, '@', 1), '.', 2), ''), 'FPC'),
         '—'
       FROM "users" u
       WHERE u.role = 'FOUNDATION'
         AND NOT EXISTS (
           SELECT 1 FROM "foundations" f WHERE f.user_id = u.id
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "foundations" DROP CONSTRAINT "FK_foundations_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "foundations"`);
  }
}
