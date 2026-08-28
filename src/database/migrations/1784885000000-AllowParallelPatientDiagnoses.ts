import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowParallelPatientDiagnoses1784885000000 implements MigrationInterface {
  name = 'AllowParallelPatientDiagnoses1784885000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_patient_diagnoses_current"');
    await queryRunner.query(
      'CREATE INDEX "IDX_patient_diagnoses_current" ON "patient_diagnoses" ("patient_id") WHERE "is_current" = true',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_patient_diagnoses_current"');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_patient_diagnoses_current" ON "patient_diagnoses" ("patient_id") WHERE "is_current" = true',
    );
  }
}
