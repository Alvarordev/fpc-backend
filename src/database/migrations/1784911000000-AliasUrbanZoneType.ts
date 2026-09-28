import { MigrationInterface, QueryRunner } from 'typeorm';

export class AliasUrbanZoneType1784911000000 implements MigrationInterface {
  name = 'AliasUrbanZoneType1784911000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE catalog_items
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{aliases}',
         (
           SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
           FROM (
             SELECT jsonb_array_elements_text(
               COALESCE(metadata->'aliases', '[]'::jsonb)
             ) AS value
             UNION ALL
             SELECT jsonb_array_elements_text($2::jsonb)
           ) merged
         )
       ),
       updated_at = now()
       WHERE kind = 'zone_type' AND code = $1`,
      ['URBANA', JSON.stringify(['URBAN', 'Urbano'])],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE catalog_items
       SET metadata = CASE
         WHEN jsonb_array_length(COALESCE(metadata->'aliases', '[]'::jsonb)) = 0
           THEN metadata - 'aliases'
         ELSE metadata
       END,
       updated_at = now()
       WHERE kind = 'zone_type' AND code = 'URBANA'`,
    );
    await queryRunner.query(
      `UPDATE catalog_items
       SET metadata = jsonb_set(
         metadata,
         '{aliases}',
         COALESCE(
           (
             SELECT jsonb_agg(value)
             FROM jsonb_array_elements_text(metadata->'aliases') AS value
             WHERE value NOT IN ('URBAN', 'Urbano')
           ),
           '[]'::jsonb
         )
       ),
       updated_at = now()
       WHERE kind = 'zone_type'
         AND code = 'URBANA'
         AND metadata ? 'aliases'`,
    );
  }
}
