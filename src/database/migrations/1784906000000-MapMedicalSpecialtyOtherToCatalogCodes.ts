import { MigrationInterface, QueryRunner } from 'typeorm';

type CatalogRow = {
  kind: string;
  code: string;
  label: string;
  metadata: { aliases?: string[] } | null;
};

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildLookup(rows: CatalogRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(normalizeKey(row.code), row.code);
    map.set(normalizeKey(row.label), row.code);
    for (const alias of row.metadata?.aliases ?? []) {
      map.set(normalizeKey(alias), row.code);
    }
  }
  return map;
}

export class MapMedicalSpecialtyOtherToCatalogCodes1784906000000
  implements MigrationInterface
{
  name = 'MapMedicalSpecialtyOtherToCatalogCodes1784906000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.upsertCatalogItems(queryRunner);
    await this.mergeAliases(queryRunner);

    const catalogRows = (await queryRunner.query(
      `SELECT kind, code, label, metadata FROM catalog_items WHERE kind = 'medical_specialty'`,
    )) as CatalogRow[];
    const lookup = buildLookup(catalogRows);

    await this.remapOtroSpecialtyColumn(
      queryRunner,
      'patient_diagnoses',
      'diagnosis_specialty',
      'diagnosis_specialty_other',
      lookup,
    );
    await this.remapOtroSpecialtyColumn(
      queryRunner,
      'patient_medical_appointments',
      'specialty',
      'specialty_other',
      lookup,
    );
    await this.remapOtroSpecialtyColumn(
      queryRunner,
      'patient_medical_appointments',
      'next_appointment_specialty',
      'next_appointment_specialty_other',
      lookup,
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Not reversible: original free text remains in *_other, but restoring
    // diagnosis_specialty / specialty to OTRO would lose the catalog mapping.
  }

  private async upsertCatalogItems(queryRunner: QueryRunner): Promise<void> {
    const inserts: Array<{
      kind: string;
      code: string;
      label: string;
      sortOrder: number;
      isSystem: boolean;
      metadata: string;
    }> = [
      {
        kind: 'medical_specialty',
        code: 'MASTOLOGIA',
        label: 'Mastología',
        sortOrder: 25,
        isSystem: false,
        metadata: JSON.stringify({ aliases: ['Mastologia', 'Mastología'] }),
      },
      {
        kind: 'medical_specialty',
        code: 'CIRUGIA_CABEZA_CUELLO',
        label: 'Cirugía de cabeza y cuello',
        sortOrder: 26,
        isSystem: false,
        metadata: JSON.stringify({
          aliases: ['Cirugía cabeza y cuello', 'Cirugia cabeza y cuello'],
        }),
      },
      {
        kind: 'medical_specialty',
        code: 'ONCOLOGIA_PEDIATRICA',
        label: 'Oncología pediátrica',
        sortOrder: 27,
        isSystem: false,
        metadata: JSON.stringify({
          aliases: ['Oncología Pediátrica', 'Oncologia pediatrica'],
        }),
      },
      {
        kind: 'medical_specialty',
        code: 'EMERGENCIA',
        label: 'Emergencia',
        sortOrder: 170,
        isSystem: false,
        metadata: JSON.stringify({ aliases: ['Emergencias'] }),
      },
      {
        kind: 'medical_specialty',
        code: 'DESCONOCIDO',
        label: 'Desconoce',
        sortOrder: 895,
        isSystem: true,
        metadata: JSON.stringify({
          aliases: ['Desconocido', 'No sabe', 'Unknown'],
        }),
      },
    ];

    for (const item of inserts) {
      await queryRunner.query(
        `INSERT INTO catalog_items (kind, code, label, sort_order, is_active, is_system, metadata)
         VALUES ($1, $2, $3, $4, true, $5, $6::jsonb)
         ON CONFLICT (kind, code) DO UPDATE
         SET label = EXCLUDED.label,
             sort_order = EXCLUDED.sort_order,
             is_system = EXCLUDED.is_system,
             metadata = EXCLUDED.metadata`,
        [
          item.kind,
          item.code,
          item.label,
          item.sortOrder,
          item.isSystem,
          item.metadata,
        ],
      );
    }
  }

  private async mergeAliases(queryRunner: QueryRunner): Promise<void> {
    const aliasUpdates: Array<[string, string[]]> = [
      [
        'GINECOLOGIA_ONCOLOGICA',
        ['Gineco-oncologia', 'Gineco oncologia', 'Ginecología oncológica'],
      ],
      ['UROLOGIA_ONCOLOGICA', ['Urología', 'Urologia', 'Urología oncológica']],
      [
        'ONCOLOGIA_QUIRURGICA',
        [
          'Cirugía oncológica',
          'Oncología quirúrgica',
          'Cirugia oncologica',
          'Cirugía oncologica',
        ],
      ],
    ];

    for (const [code, aliases] of aliasUpdates) {
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
         WHERE kind = 'medical_specialty' AND code = $1`,
        [code, JSON.stringify(aliases)],
      );
    }
  }

  private async remapOtroSpecialtyColumn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    otherColumn: string,
    lookup: Map<string, string>,
  ): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT id, "${otherColumn}" AS other_value
       FROM "${table}"
       WHERE "${column}" = 'OTRO'
         AND "${otherColumn}" IS NOT NULL
         AND BTRIM("${otherColumn}") <> ''`,
    )) as Array<{ id: string; other_value: string }>;

    for (const row of rows) {
      const code = lookup.get(normalizeKey(row.other_value));
      if (!code || code === 'OTRO') continue;
      await queryRunner.query(
        `UPDATE "${table}" SET "${column}" = $1 WHERE id = $2`,
        [code, row.id],
      );
    }
  }
}
