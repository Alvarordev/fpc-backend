import { MigrationInterface, QueryRunner } from 'typeorm';

// In-place diagnosis corrections keep the diagnosis id stable and log the
// overwritten values here.
export class AddPatientDiagnosisRevisions1784914000000 implements MigrationInterface {
  name = 'AddPatientDiagnosisRevisions1784914000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "patient_diagnosis_revisions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "diagnosis_id" uuid NOT NULL REFERENCES "patient_diagnoses"("id"), "follow_up_id" uuid NOT NULL REFERENCES "follow_ups"("id"), "changed_by_id" uuid REFERENCES "users"("id"), "change_reason" text NOT NULL, "previous_values" jsonb NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_diagnosis_revisions_diagnosis_id" ON "patient_diagnosis_revisions" ("diagnosis_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_diagnosis_revisions_follow_up_id" ON "patient_diagnosis_revisions" ("follow_up_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "patient_diagnosis_revisions"');
  }
}
