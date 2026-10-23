import { MigrationInterface, QueryRunner } from 'typeorm';

// A patient keeps a single primary contact but may have several secondary ones.
export class AllowMultipleSecondaryContacts1784915000000 implements MigrationInterface {
  name = 'AllowMultipleSecondaryContacts1784915000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_companion_patient_secondary_contact"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep only the oldest secondary contact per patient before restoring uniqueness.
    await queryRunner.query(
      `UPDATE "companion_patient" SET "contact_role" = NULL WHERE "contact_role" = 'SECONDARY' AND "id" NOT IN (SELECT DISTINCT ON ("patient_id") "id" FROM "companion_patient" WHERE "contact_role" = 'SECONDARY' ORDER BY "patient_id", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_companion_patient_secondary_contact" ON "companion_patient" ("patient_id") WHERE "contact_role" = 'SECONDARY'`,
    );
  }
}
