import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHealthCenterCategory1784893000000 implements MigrationInterface {
  name = 'AddHealthCenterCategory1784893000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "health_centers" ADD COLUMN "category" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "health_centers" ADD CONSTRAINT "CHK_health_centers_category" CHECK ("category" IS NULL OR "category" IN ('I-1','I-2','I-3','I-4','II-1','II-2','II-E','III-1','III-E','III-2'))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "health_centers" DROP CONSTRAINT "CHK_health_centers_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "health_centers" DROP COLUMN "category"`,
    );
  }
}
