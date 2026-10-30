import { MigrationInterface, QueryRunner } from 'typeorm';

// Free-text evolution of a diagnosis (e.g. metastasis to other organs).
export class AddDiagnosisDiseaseEvolution1784918000000 implements MigrationInterface {
  name = 'AddDiagnosisDiseaseEvolution1784918000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" ADD COLUMN "disease_evolution" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" DROP COLUMN "disease_evolution"`,
    );
  }
}
