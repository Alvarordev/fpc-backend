import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientChildrenCount1784903000000 implements MigrationInterface {
  name = 'AddPatientChildrenCount1784903000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "children_count" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_children_count_non_negative" CHECK ("children_count" IS NULL OR "children_count" >= 0)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP CONSTRAINT "CHK_patient_details_children_count_non_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "children_count"`,
    );
  }
}
