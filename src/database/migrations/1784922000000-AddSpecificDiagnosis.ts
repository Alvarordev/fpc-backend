import { MigrationInterface, QueryRunner } from 'typeorm';

/** Keep all existing diagnosis values as general; specifics are opt-in. */
export class AddSpecificDiagnosis1784922000000 implements MigrationInterface {
  name = 'AddSpecificDiagnosis1784922000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" ADD COLUMN "specific_diagnosis" varchar(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" DROP COLUMN "specific_diagnosis"`,
    );
  }
}
