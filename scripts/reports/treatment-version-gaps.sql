-- Treatment versions that lost values the previous version had.
--
-- Until 2026-10 a new version of a treatment line was saved only with what the
-- form re-sent, so fields it did not send (sessions, reasons, dates...) came
-- out empty. Read-only: run it against production and decide with the numbers
-- whether to backfill.
--
--   psql "$DATABASE_URL" -f scripts/reports/treatment-version-gaps.sql

WITH versions AS (
  SELECT
    treatment.series_id,
    treatment.patient_id,
    treatment.id,
    treatment.created_at,
    to_jsonb(treatment.*) AS data,
    LAG(to_jsonb(treatment.*)) OVER (
      PARTITION BY treatment.series_id
      ORDER BY treatment.created_at, treatment.id
    ) AS previous
  FROM patient_treatments treatment
),
gaps AS (
  SELECT
    versions.series_id,
    versions.patient_id,
    versions.id AS version_id,
    versions.created_at,
    entry.key AS field,
    entry.value AS lost_value
  FROM versions
  CROSS JOIN LATERAL jsonb_each(versions.previous) entry
  WHERE versions.previous IS NOT NULL
    AND entry.key NOT IN (
      'id', 'is_current', 'created_at', 'updated_at', 'follow_up_id',
      'change_reason'
    )
    AND entry.value <> 'null'::jsonb
    AND COALESCE(versions.data -> entry.key, 'null'::jsonb) = 'null'::jsonb
)
SELECT '1. Resumen por campo' AS section, field, COUNT(*) AS versions,
  COUNT(DISTINCT series_id) AS treatment_lines,
  COUNT(DISTINCT patient_id) AS patients,
  NULL::text AS detail
FROM gaps
GROUP BY field
UNION ALL
SELECT '2. Lineas vigentes afectadas', field, COUNT(*), COUNT(DISTINCT gaps.series_id),
  COUNT(DISTINCT gaps.patient_id), NULL
FROM gaps
JOIN patient_treatments current
  ON current.series_id = gaps.series_id AND current.is_current
 AND COALESCE(to_jsonb(current.*) -> gaps.field, 'null'::jsonb) = 'null'::jsonb
GROUP BY field
ORDER BY section, versions DESC;

-- Detail of the lines whose CURRENT version is still missing the value:
-- SELECT gaps.* FROM gaps JOIN patient_treatments current ON ... (same join as section 2)
