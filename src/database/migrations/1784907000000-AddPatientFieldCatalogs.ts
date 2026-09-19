import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientFieldCatalogs1784907000000
  implements MigrationInterface
{
  name = 'AddPatientFieldCatalogs1784907000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "health_centers" DROP CONSTRAINT IF EXISTS "CHK_health_centers_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "health_centers" ALTER COLUMN "category" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "birth_country" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "chemotherapy_route" character varying(100)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "chemotherapy_route"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "birth_country"`,
    );
    await queryRunner.query(
      `ALTER TABLE "health_centers" ALTER COLUMN "category" TYPE character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "health_centers" ADD CONSTRAINT "CHK_health_centers_category" CHECK ("category" IS NULL OR "category" IN ('I-1','I-2','I-3','I-4','II-1','II-2','II-E','III-1','III-E','III-2'))`,
    );
  }
}
