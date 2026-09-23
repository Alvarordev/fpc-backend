import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelaxPatientInsuranceCatalogChecks1784908000000
  implements MigrationInterface
{
  name = 'RelaxPatientInsuranceCatalogChecks1784908000000';

  async up(queryRunner: QueryRunner): Promise<void> {
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
            AND rel.relname = 'patient_insurance'
            AND con.contype = 'c'
            AND (
              pg_get_constraintdef(con.oid) ILIKE '%insurance_type%'
              OR pg_get_constraintdef(con.oid) ILIKE '%eps_provider%'
            )
        LOOP
          EXECUTE format(
            'ALTER TABLE patient_insurance DROP CONSTRAINT %I',
            constraint_name
          );
        END LOOP;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "patient_insurance" ALTER COLUMN "insurance_type" TYPE character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_insurance" ALTER COLUMN "eps_provider" TYPE character varying(100)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_insurance" ALTER COLUMN "insurance_type" TYPE character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_insurance" ALTER COLUMN "eps_provider" TYPE character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_insurance" ADD CONSTRAINT "patient_insurance_insurance_type_check" CHECK ("insurance_type" IN ('SIS','ESSALUD','EPS','FUERZAS_ARMADAS','SALUDPOL','NONE'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_insurance" ADD CONSTRAINT "patient_insurance_eps_provider_check" CHECK ("eps_provider" IS NULL OR "eps_provider" IN ('RIMAC','PACIFICO','MAPFRE','SANITAS','LA_POSITIVA','ONCOSALUD','OTHER'))`,
    );
  }
}
