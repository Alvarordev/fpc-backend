import { MigrationInterface, QueryRunner } from 'typeorm';

const CATALOG_CHECK_COLUMNS: Record<string, string[]> = {
  patient_details: [
    'education_level',
    'health_phase',
    'health_subcategory',
    'transportation_sepa_provider',
    'shelter_sepa_provider',
    'program_dropout_reason_code',
  ],
  patient_health_phase_history: ['health_phase'],
  patient_diagnoses: ['cancer_stage'],
  patient_treatments: [
    'treatment_situation',
    'care_program',
    'access_barrier_code',
  ],
};

const WIDEN_COLUMNS: Array<[string, string]> = [
  ['patient_details', 'health_phase'],
  ['patient_details', 'health_subcategory'],
  ['patient_details', 'zone_type'],
  ['patient_details', 'education_level'],
  ['patient_details', 'transportation_sepa_provider'],
  ['patient_details', 'shelter_sepa_provider'],
  ['patient_details', 'program_dropout_reason_code'],
  ['patient_health_phase_history', 'health_phase'],
  ['patient_health_subcategory_history', 'health_subcategory'],
  ['patient_diagnoses', 'cancer_stage'],
  ['patient_treatments', 'care_program'],
  ['patient_treatments', 'treatment_situation'],
  ['patient_treatments', 'access_barrier_code'],
  ['enrollments', 'entry_source'],
  ['enrollments', 'entry_sub_source'],
];

export class RelaxCatalogFieldChecks1784909000000
  implements MigrationInterface
{
  name = 'RelaxCatalogFieldChecks1784909000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, columns] of Object.entries(CATALOG_CHECK_COLUMNS)) {
      const predicates = columns
        .map((column) => `pg_get_constraintdef(con.oid) ILIKE '%${column}%'`)
        .join('\n              OR ');
      await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        FOR constraint_name IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
          WHERE nsp.nspname = current_schema()
            AND rel.relname = '${table}'
            AND con.contype = 'c'
            AND (
              ${predicates}
            )
        LOOP
          EXECUTE format(
            'ALTER TABLE ${table} DROP CONSTRAINT %I',
            constraint_name
          );
        END LOOP;
      END $$;
    `);
    }

    for (const [table, column] of WIDEN_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE character varying(100)`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_details" ALTER COLUMN "health_phase" TYPE character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ALTER COLUMN "health_subcategory" TYPE character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ALTER COLUMN "zone_type" TYPE character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ALTER COLUMN "education_level" TYPE character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ALTER COLUMN "transportation_sepa_provider" TYPE character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ALTER COLUMN "shelter_sepa_provider" TYPE character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ALTER COLUMN "program_dropout_reason_code" TYPE character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_health_phase_history" ALTER COLUMN "health_phase" TYPE character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_health_subcategory_history" ALTER COLUMN "health_subcategory" TYPE character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" ALTER COLUMN "cancer_stage" TYPE character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ALTER COLUMN "care_program" TYPE character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ALTER COLUMN "treatment_situation" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ALTER COLUMN "access_barrier_code" TYPE character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ALTER COLUMN "entry_source" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ALTER COLUMN "entry_sub_source" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "patient_details_education_level_check" CHECK ("education_level" IN ('INITIAL', 'PRIMARY_INCOMPLETE', 'PRIMARY', 'SECONDARY_INCOMPLETE', 'SECONDARY', 'TECHNICAL', 'TECHNICAL_INCOMPLETE', 'HIGHER', 'HIGHER_INCOMPLETE', 'NONE'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_health_phase" CHECK ("health_phase" IS NULL OR "health_phase" IN ('CANCER_DIAGNOSIS', 'ANNUAL_CHECKUP', 'SIGNS_AND_SYMPTOMS'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_health_subcategory" CHECK ("health_subcategory" IS NULL OR "health_subcategory" IN ('SIGNS_AND_SYMPTOMS_PATIENT', 'ACTIVE_TREATMENT', 'UNDER_CONTROLS', 'TREATMENT_ABANDONED', 'PALLIATIVE_NO_ACTIVE_TREATMENT', 'CANCER_RULED_OUT'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_transportation_sepa_provider" CHECK ("transportation_sepa_provider" IS NULL OR "transportation_sepa_provider" IN ('CRUZ_DEL_SUR','LATAM_AVION_SOLIDARIO','OTHER'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_shelter_sepa_provider" CHECK ("shelter_sepa_provider" IS NULL OR "shelter_sepa_provider" IN ('FRIEDA_HELLER','CASA_MAGIA','CASA_RONALD_MCDONALD','INSPIRA','ALINEN','OTHER'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_program_dropout_reason_code" CHECK ("program_dropout_reason_code" IS NULL OR "program_dropout_reason_code" IN ('VOLUNTARY','UNLOCATABLE','DECEASED','OTHER'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_health_phase_history" ADD CONSTRAINT "CHK_patient_health_phase_history_phase" CHECK ("health_phase" IN ('CANCER_DIAGNOSIS', 'ANNUAL_CHECKUP', 'SIGNS_AND_SYMPTOMS'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" ADD CONSTRAINT "patient_diagnoses_cancer_stage_check" CHECK ("cancer_stage" IS NULL OR "cancer_stage" IN ('STAGE_1','STAGE_2','STAGE_3','STAGE_4','UNKNOWN'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD CONSTRAINT "patient_treatments_treatment_situation_check" CHECK ("treatment_situation" IS NULL OR "treatment_situation" IN ('EN_CURSO','PENDIENTE_DE_INICIO','INTERRUMPIDO','FINALIZADO','SEARCHING','ABANDONED','DECEASED_DURING_TREATMENT','NOT_APPLICABLE','REMISSION'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD CONSTRAINT "patient_treatments_care_program_check" CHECK ("care_program" IS NULL OR "care_program" IN ('COPHOES','PADOMI'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD CONSTRAINT "patient_treatments_access_barrier_code_check" CHECK ("access_barrier_code" IS NULL OR "access_barrier_code" IN ('TRANSFER','LODGING','ALTERNATIVE_MEDICINE','EXCESSIVE_COST','DOES_NOT_WANT_TO_START','STOCKOUT','INFUSION_ROOM_INOPERATIVE','PATIENT_OVERLOAD','OTHER'))`,
    );
  }
}
