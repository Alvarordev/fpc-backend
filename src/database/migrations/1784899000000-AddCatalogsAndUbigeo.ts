import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCatalogsAndUbigeo1784899000000 implements MigrationInterface {
  name = 'AddCatalogsAndUbigeo1784899000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalog_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "kind" character varying(50) NOT NULL,
        "code" character varying(100) NOT NULL,
        "label" character varying(255) NOT NULL,
        "parent_code" character varying(100),
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_system" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_catalog_items_kind_code" UNIQUE ("kind", "code")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_catalog_items_kind_active" ON "catalog_items" ("kind", "is_active")`,
    );

    await queryRunner.query(`
      CREATE TABLE "ubigeo_departments" (
        "code" character varying(50) NOT NULL,
        "inei_code" character varying(2) NOT NULL,
        "name" character varying(120) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_ubigeo_departments_code" PRIMARY KEY ("code"),
        CONSTRAINT "UQ_ubigeo_departments_inei_code" UNIQUE ("inei_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ubigeo_provinces" (
        "inei_code" character varying(4) NOT NULL,
        "department_code" character varying(50) NOT NULL,
        "name" character varying(120) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_ubigeo_provinces_inei_code" PRIMARY KEY ("inei_code"),
        CONSTRAINT "FK_ubigeo_provinces_department_code"
          FOREIGN KEY ("department_code") REFERENCES "ubigeo_departments"("code")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ubigeo_provinces_department_code" ON "ubigeo_provinces" ("department_code")`,
    );

    await queryRunner.query(`
      CREATE TABLE "ubigeo_districts" (
        "inei_code" character varying(6) NOT NULL,
        "province_inei_code" character varying(4) NOT NULL,
        "name" character varying(120) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_ubigeo_districts_inei_code" PRIMARY KEY ("inei_code"),
        CONSTRAINT "FK_ubigeo_districts_province_inei_code"
          FOREIGN KEY ("province_inei_code") REFERENCES "ubigeo_provinces"("inei_code")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ubigeo_districts_province_inei_code" ON "ubigeo_districts" ("province_inei_code")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ubigeo_districts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ubigeo_provinces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ubigeo_departments"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_catalog_items_kind_active"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_items"`);
  }
}
