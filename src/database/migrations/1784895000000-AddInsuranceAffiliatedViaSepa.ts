import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInsuranceAffiliatedViaSepa1784895000000
  implements MigrationInterface
{
  name = 'AddInsuranceAffiliatedViaSepa1784895000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_insurance" ADD COLUMN "affiliated_via_sepa" boolean`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_insurance" DROP COLUMN "affiliated_via_sepa"`,
    );
  }
}
