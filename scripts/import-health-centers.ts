/**
 * Imports health facilities (RENIPRESS / CENEPRED shapefile .dbf) into
 * health_centers.
 *
 *   npx ts-node scripts/import-health-centers.ts --file <path.dbf> [--apply]
 *     [--map manual-matches.json] [--report report.json] [--include-inactive]
 *
 * Dry run by default. Existing hospitals are matched by RENIPRESS code, then by
 * normalised name within the same department. Matches get code, institution
 * and ubigeo; ambiguous or unmatched hospitals are only reported, never
 * changed. `--map` takes {"<healthCenterId>": "<renipressCode>"} to settle
 * ambiguous cases by hand. Facilities nobody matched are inserted (active
 * ones only unless --include-inactive). The source has no MINSA category
 * (I-1…III-E), so care_category is left untouched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import dataSource from '../src/database/data-source';

type SourceRow = {
  code: string;
  name: string;
  department: string | null;
  province: string;
  district: string;
  institution: string;
  condition: string;
};

type Existing = {
  id: string;
  name: string;
  department: string;
  renipress_code: string | null;
};

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const apply = args.includes('--apply');
const includeInactive = args.includes('--include-inactive');
const file = option('--file');
const reportPath = option('--report') ?? 'health-centers-import-report.json';
const manualMap: Record<string, string> = option('--map')
  ? (JSON.parse(readFileSync(option('--map')!, 'utf8')) as Record<
      string,
      string
    >)
  : {};

const STOPWORDS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'E']);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token && !STOPWORDS.has(token))
    .join(' ');
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter(Boolean));
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function institutionFor(raw: string): string {
  const value = normalize(raw);
  if (value === 'GOBIERNO REGIONAL') return 'GOBIERNO_REGIONAL';
  if (value === 'PRIVADO') return 'PRIVADO';
  if (value === 'MINSA') return 'MINSA';
  if (value === 'ESSALUD') return 'ESSALUD';
  if (value.startsWith('SANIDAD')) return 'FFAA_PNP';
  return 'OTRO';
}

/** Minimal dBASE III reader: header, field descriptors, fixed-width records. */
function readDbf(path: string): Record<string, string>[] {
  const buffer = readFileSync(path);
  const count = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const fields: { name: string; length: number }[] = [];
  for (let offset = 32; buffer[offset] !== 0x0d; offset += 32) {
    fields.push({
      name: buffer
        .subarray(offset, offset + 11)
        .toString('latin1')
        .replace(/\0.*$/, ''),
      length: buffer[offset + 16],
    });
  }
  const rows: Record<string, string>[] = [];
  for (let index = 0; index < count; index++) {
    const start = headerLength + index * recordLength;
    if (buffer[start] === 0x2a) continue;
    let cursor = start + 1;
    const row: Record<string, string> = {};
    for (const field of fields) {
      row[field.name] = buffer
        .subarray(cursor, cursor + field.length)
        .toString('utf8')
        .replace(/\s+/g, ' ')
        .trim();
      cursor += field.length;
    }
    rows.push(row);
  }
  return rows;
}

async function rows<T>(sql: string): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return (await dataSource.query(sql)) as T[];
}

async function main() {
  if (!file) throw new Error('--file <path.dbf> is required');
  const source: SourceRow[] = readDbf(file)
    .filter((row) => /^\d+$/.test(row.codigo_min) && row.nombre_del)
    .map((row) => ({
      code: row.codigo_min,
      name: row.nombre_del,
      department: row.departamen
        ? row.departamen
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toUpperCase()
            .trim()
            .replace(/\s+/g, '_')
        : null,
      province: row.provincia,
      district: row.distrito,
      institution: institutionFor(row.institucio),
      condition: row.estabcondi,
    }));

  await dataSource.initialize();
  const departments = new Set(
    (await rows<{ code: string }>(`SELECT code FROM ubigeo_departments`)).map(
      (row) => row.code,
    ),
  );
  const ubigeo = new Map<string, string>();
  for (const row of await rows<{
    inei_code: string;
    district: string;
    province: string;
    department_code: string;
  }>(`
    SELECT d.inei_code, d.name AS district, p.name AS province, p.department_code
      FROM ubigeo_districts d
      JOIN ubigeo_provinces p ON p.inei_code = d.province_inei_code
  `)) {
    ubigeo.set(
      `${row.department_code}|${normalize(row.province)}|${normalize(row.district)}`,
      row.inei_code,
    );
  }
  const ubigeoFor = (row: SourceRow) =>
    ubigeo.get(
      `${row.department}|${normalize(row.province)}|${normalize(row.district)}`,
    ) ?? null;

  const existing = await rows<Existing>(
    `SELECT id, name, department, renipress_code FROM health_centers`,
  );
  const existingSlugs = new Set(
    (await rows<{ slug: string }>(`SELECT slug FROM health_centers`)).map(
      (row) => row.slug,
    ),
  );

  const byCode = new Map(source.map((row) => [row.code, row]));
  const byKey = new Map<string, SourceRow[]>();
  for (const row of source) {
    const key = `${row.department}|${normalize(row.name)}`;
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }

  const matched: { hospital: Existing; row: SourceRow; by: string }[] = [];
  const ambiguous: {
    hospital: Existing;
    reason: string;
    candidates: { code: string; name: string; district: string }[];
  }[] = [];
  const unmatched: Existing[] = [];
  const claimed = new Set<string>();

  for (const hospital of existing) {
    const manual = manualMap[hospital.id];
    const code = manual ?? hospital.renipress_code;
    if (code) {
      const row = byCode.get(code);
      if (row) matched.push({ hospital, row, by: manual ? 'manual' : 'code' });
      else
        ambiguous.push({
          hospital,
          reason: `code ${code} not found in source`,
          candidates: [],
        });
      continue;
    }
    const exact = byKey.get(
      `${hospital.department}|${normalize(hospital.name)}`,
    );
    if (exact?.length === 1) {
      matched.push({ hospital, row: exact[0], by: 'name' });
      continue;
    }
    if (exact && exact.length > 1) {
      ambiguous.push({
        hospital,
        reason: 'several facilities with the same name in the department',
        candidates: exact.map(({ code, name, district }) => ({
          code,
          name,
          district,
        })),
      });
      continue;
    }
    const wanted = tokens(hospital.name);
    const similar = source
      .filter((row) => row.department === hospital.department)
      .filter((row) => {
        const candidate = tokens(row.name);
        const shared = [...wanted].filter((token) => candidate.has(token));
        return (
          shared.length >= Math.min(3, wanted.size) &&
          shared.length >= Math.ceil(wanted.size * 0.6)
        );
      })
      .slice(0, 8);
    if (similar.length)
      ambiguous.push({
        hospital,
        reason: 'no exact name match; similar names found',
        candidates: similar.map(({ code, name, district }) => ({
          code,
          name,
          district,
        })),
      });
    else unmatched.push(hospital);
  }

  const duplicateClaims = new Map<string, number>();
  for (const { row } of matched)
    duplicateClaims.set(row.code, (duplicateClaims.get(row.code) ?? 0) + 1);
  const conflicting = matched.filter(
    ({ row }) => (duplicateClaims.get(row.code) ?? 0) > 1,
  );
  const safeMatches = matched.filter(
    ({ row }) => (duplicateClaims.get(row.code) ?? 0) === 1,
  );
  for (const { hospital, row } of conflicting)
    ambiguous.push({
      hospital,
      reason: `facility ${row.code} matched by several hospitals`,
      candidates: [{ code: row.code, name: row.name, district: row.district }],
    });

  for (const { row } of safeMatches) claimed.add(row.code);
  for (const item of ambiguous)
    for (const candidate of item.candidates) claimed.add(candidate.code);

  const toInsert = source.filter(
    (row) =>
      !claimed.has(row.code) &&
      row.department &&
      departments.has(row.department) &&
      (includeInactive || row.condition === 'ACTIVO'),
  );
  const skipped = source.length - toInsert.length - safeMatches.length;

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    sourceRows: source.length,
    existingHospitals: existing.length,
    matched: safeMatches.map(({ hospital, row, by }) => ({
      id: hospital.id,
      name: hospital.name,
      by,
      renipressCode: row.code,
      sourceName: row.name,
      institution: row.institution,
      ubigeoDistrictCode: ubigeoFor(row),
    })),
    ambiguous: ambiguous.map(({ hospital, reason, candidates }) => ({
      id: hospital.id,
      name: hospital.name,
      department: hospital.department,
      reason,
      candidates,
    })),
    unmatched: unmatched.map(({ id, name, department }) => ({
      id,
      name,
      department,
    })),
    toInsert: toInsert.length,
    toInsertWithUbigeo: toInsert.filter((row) => ubigeoFor(row)).length,
    skippedInactiveOrUnknownDepartmentOrReserved: skipped,
  };

  if (apply) {
    await dataSource.transaction(async (manager) => {
      for (const { hospital, row } of safeMatches) {
        await manager.query(
          `UPDATE health_centers
              SET renipress_code = $2,
                  institution = $3,
                  ubigeo_district_code = COALESCE($4, ubigeo_district_code),
                  updated_at = now()
            WHERE id = $1`,
          [hospital.id, row.code, row.institution, ubigeoFor(row)],
        );
      }
      for (let start = 0; start < toInsert.length; start += 500) {
        const chunk = toInsert.slice(start, start + 500).filter((row) => {
          const value = `${slug(row.name)}-${row.code}`;
          if (existingSlugs.has(value)) return false;
          existingSlugs.add(value);
          return true;
        });
        if (!chunk.length) continue;
        const params: unknown[] = [];
        const values = chunk.map((row) => {
          params.push(
            row.name,
            `${slug(row.name)}-${row.code}`,
            row.department,
            row.institution,
            ubigeoFor(row),
            row.code,
            row.condition === 'ACTIVO',
          );
          const base = params.length - 7;
          return `(${[1, 2, 3, 4, 5, 6, 7].map((n) => `$${base + n}`).join(', ')})`;
        });
        await manager.query(
          `INSERT INTO health_centers
             (name, slug, department, institution, ubigeo_district_code, renipress_code, is_active)
           VALUES ${values.join(', ')}
           ON CONFLICT DO NOTHING`,
          params,
        );
      }
    });
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        sourceRows: report.sourceRows,
        existingHospitals: report.existingHospitals,
        matched: report.matched.length,
        ambiguous: report.ambiguous.length,
        unmatched: report.unmatched.length,
        toInsert: report.toInsert,
        toInsertWithUbigeo: report.toInsertWithUbigeo,
        skipped: report.skippedInactiveOrUnknownDepartmentOrReserved,
        report: reportPath,
      },
      null,
      2,
    ),
  );
  await dataSource.destroy();
}

main().catch(async (error) => {
  console.error(error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
