import { MigrationInterface, QueryRunner } from 'typeorm';

const NARRATIVE_COLUMNS: Array<[string, string]> = [
  ['patient_medical_appointments', 'difficulties'],
  ['patient_medical_appointments', 'referred_to'],
  ['patient_symptom_reports', 'pain_location'],
  ['patient_treatments', 'operation_name'],
  ['treatment_medications', 'dose_description'],
  ['patient_active_comorbidities', 'condition_name'],
];

export class WidenNarrativeTextColumns1784910000000
  implements MigrationInterface
{
  name = 'WidenNarrativeTextColumns1784910000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of NARRATIVE_COLUMNS) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = '${table}'
              AND column_name = '${column}'
              AND data_type = 'character varying'
          ) THEN
            EXECUTE 'ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE text';
          END IF;
        END $$;
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of NARRATIVE_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE character varying(255)`,
      );
    }
  }
}
