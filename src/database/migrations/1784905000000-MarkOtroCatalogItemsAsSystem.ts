import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarkOtroCatalogItemsAsSystem1784905000000
  implements MigrationInterface
{
  name = 'MarkOtroCatalogItemsAsSystem1784905000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "catalog_items"
      SET "is_system" = true, "updated_at" = now()
      WHERE "code" = 'OTRO'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "catalog_items"
      SET "is_system" = false, "updated_at" = now()
      WHERE "code" = 'OTRO'
        AND "kind" IN ('cancer_diagnosis', 'medical_specialty', 'treatment_type')
    `);
  }
}
