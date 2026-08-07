import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanionRelationship1784874000000 implements MigrationInterface {
  name = 'AddCompanionRelationship1784874000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "companion_patient" ADD COLUMN "relationship" varchar(50)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "companion_patient" DROP COLUMN "relationship"`);
  }
}
