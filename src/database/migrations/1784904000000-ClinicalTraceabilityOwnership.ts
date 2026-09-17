import { MigrationInterface, QueryRunner } from 'typeorm';

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

type CatalogRow = {
  kind: string;
  code: string;
  label: string;
  metadata: { aliases?: string[] } | null;
};

function buildLookup(rows: CatalogRow[]) {
  const byKind = new Map<string, Map<string, string>>();
  for (const row of rows) {
    const map = byKind.get(row.kind) ?? new Map<string, string>();
    map.set(normalizeKey(row.code), row.code);
    map.set(normalizeKey(row.label), row.code);
    for (const alias of row.metadata?.aliases ?? []) {
      map.set(normalizeKey(alias), row.code);
    }
    byKind.set(row.kind, map);
  }
  return byKind;
}

export class ClinicalTraceabilityOwnership1784904000000 implements MigrationInterface {
  name = 'ClinicalTraceabilityOwnership1784904000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" ADD COLUMN IF NOT EXISTS "diagnosis_other" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" ADD COLUMN IF NOT EXISTS "diagnosis_specialty_other" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN IF NOT EXISTS "treatment_type_other" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" ADD COLUMN IF NOT EXISTS "referred_health_center_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" ADD COLUMN IF NOT EXISTS "specialty_other" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" ADD COLUMN IF NOT EXISTS "next_appointment_specialty_other" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "treatment_medications" ADD COLUMN IF NOT EXISTS "follow_up_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "treatment_medications" ADD COLUMN IF NOT EXISTS "is_current" boolean NOT NULL DEFAULT true`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_health_subcategory_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
        "health_subcategory" varchar(40) NOT NULL,
        "changed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_health_subcategory_history_patient_changed_at" ON "patient_health_subcategory_history" ("patient_id", "changed_at")`,
    );

    await queryRunner.query(`
      ALTER TABLE "patient_medical_appointments"
        DROP CONSTRAINT IF EXISTS "FK_patient_medical_appointments_referred_health_center_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_medical_appointments"
        ADD CONSTRAINT "FK_patient_medical_appointments_referred_health_center_id"
        FOREIGN KEY ("referred_health_center_id") REFERENCES "health_centers"("id")
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_medical_appointments_referred_health_center_id" ON "patient_medical_appointments" ("referred_health_center_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "treatment_medications"
        DROP CONSTRAINT IF EXISTS "FK_treatment_medications_follow_up_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "treatment_medications"
        ADD CONSTRAINT "FK_treatment_medications_follow_up_id"
        FOREIGN KEY ("follow_up_id") REFERENCES "follow_ups"("id")
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_treatment_medications_follow_up_id" ON "treatment_medications" ("follow_up_id")`,
    );

    await this.upsertCatalogItems(queryRunner);

    const catalogRows = (await queryRunner.query(
      `SELECT kind, code, label, metadata FROM catalog_items WHERE kind IN ('cancer_diagnosis','medical_specialty','treatment_type')`,
    )) as CatalogRow[];
    const lookup = buildLookup(catalogRows);

    await this.normalizeColumn(
      queryRunner,
      'patient_diagnoses',
      'diagnosis',
      'diagnosis_other',
      'cancer_diagnosis',
      lookup,
    );
    await this.normalizeColumn(
      queryRunner,
      'patient_diagnoses',
      'diagnosis_specialty',
      'diagnosis_specialty_other',
      'medical_specialty',
      lookup,
    );
    await this.normalizeColumn(
      queryRunner,
      'patient_treatments',
      'treatment_type',
      'treatment_type_other',
      'treatment_type',
      lookup,
    );
    await this.normalizeColumn(
      queryRunner,
      'patient_medical_appointments',
      'specialty',
      'specialty_other',
      'medical_specialty',
      lookup,
    );
    await this.normalizeColumn(
      queryRunner,
      'patient_medical_appointments',
      'next_appointment_specialty',
      'next_appointment_specialty_other',
      'medical_specialty',
      lookup,
    );
    await this.normalizeColumn(
      queryRunner,
      'patient_non_oncological_follow_ups',
      'control_specialty',
      null,
      'medical_specialty',
      lookup,
      true,
    );

    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY patient_id, specialty
          ORDER BY created_at DESC, id DESC
        ) AS rn
        FROM patient_medical_appointments
        WHERE is_current = true
      )
      UPDATE patient_medical_appointments appointment
      SET is_current = false
      FROM ranked
      WHERE appointment.id = ranked.id AND ranked.rn > 1
    `);

    await queryRunner.query(`
      INSERT INTO patient_medical_appointments (
        patient_id, follow_up_id, health_center_id, referred_health_center_id,
        specialty, appointment_date, next_appointment_date, has_referral_sheet,
        referral_not_provided_reason, is_first_consultation, status, is_current,
        is_historical, created_at, updated_at
      )
      SELECT
        symptom.patient_id,
        symptom.follow_up_id,
        symptom.health_center_id,
        symptom.referred_health_center_id,
        COALESCE(NULLIF(BTRIM(symptom.specialty), ''), 'MEDICINA_GENERAL'),
        COALESCE(symptom.first_consultation_date, (symptom.created_at AT TIME ZONE 'America/Lima')::date),
        symptom.next_consultation_date,
        symptom.has_referral,
        symptom.referral_not_provided_reason,
        true,
        CASE
          WHEN symptom.consultation_status = 'SCHEDULED' THEN 'SCHEDULED'
          ELSE 'COMPLETED'
        END,
        false,
        false,
        symptom.created_at,
        symptom.created_at
      FROM patient_symptom_reports symptom
      WHERE (
        symptom.has_medical_consultation = true
        OR symptom.consultation_status IN ('SCHEDULED', 'ATTENDED')
      )
      AND NOT EXISTS (
        SELECT 1 FROM patient_medical_appointments appointment
        WHERE appointment.follow_up_id = symptom.follow_up_id
      )
    `);

    await this.normalizeColumn(
      queryRunner,
      'patient_medical_appointments',
      'specialty',
      'specialty_other',
      'medical_specialty',
      lookup,
    );

    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY patient_id, specialty
          ORDER BY is_current DESC, created_at DESC, id DESC
        ) AS rn
        FROM patient_medical_appointments
      )
      UPDATE patient_medical_appointments appointment
      SET is_current = ranked.rn = 1
      FROM ranked
      WHERE appointment.id = ranked.id
    `);

    await this.backfillDiagnosticOwnership(queryRunner, lookup);

    await queryRunner.query(`
      UPDATE treatment_medications medication
      SET follow_up_id = treatment.follow_up_id
      FROM patient_treatments treatment
      WHERE treatment.id = medication.treatment_id
        AND medication.follow_up_id IS NULL
    `);

    await queryRunner.query(`DROP VIEW IF EXISTS patient_clinical_milestones`);
    await queryRunner.query(`
      CREATE VIEW patient_clinical_milestones AS
      WITH symptoms_onset AS (
        SELECT DISTINCT ON (patient_id)
          patient_id,
          'SYMPTOMS_ONSET'::text AS milestone_type,
          occurred_on,
          source_table,
          source_id,
          follow_up_id
        FROM (
          SELECT
            diagnosis.patient_id,
            diagnosis.first_symptoms_date AS occurred_on,
            'patient_diagnoses'::text AS source_table,
            diagnosis.id AS source_id,
            diagnosis.follow_up_id
          FROM patient_diagnoses diagnosis
          WHERE diagnosis.first_symptoms_date IS NOT NULL
          UNION ALL
          SELECT
            symptom.patient_id,
            (symptom.created_at AT TIME ZONE 'America/Lima')::date,
            'patient_symptom_reports',
            symptom.id,
            symptom.follow_up_id
          FROM patient_symptom_reports symptom
        ) symptoms
        ORDER BY patient_id, occurred_on ASC, source_id ASC
      ),
      first_primary_care AS (
        SELECT DISTINCT ON (patient_id)
          patient_id,
          'FIRST_PRIMARY_CARE'::text AS milestone_type,
          appointment_date AS occurred_on,
          'patient_medical_appointments'::text AS source_table,
          id AS source_id,
          follow_up_id
        FROM patient_medical_appointments
        WHERE appointment_date IS NOT NULL
        ORDER BY patient_id, is_first_consultation DESC, appointment_date ASC, created_at ASC, id ASC
      ),
      diagnosis_confirmed AS (
        SELECT DISTINCT ON (patient_id)
          patient_id,
          'DIAGNOSIS_CONFIRMED'::text AS milestone_type,
          (occurred_at AT TIME ZONE 'America/Lima')::date AS occurred_on,
          'patient_diagnostic_status_events'::text AS source_table,
          id AS source_id,
          follow_up_id
        FROM patient_diagnostic_status_events
        WHERE status = 'CONFIRMED'
        ORDER BY patient_id, occurred_at ASC, created_at ASC, id ASC
      ),
      diagnosis_ruled_out AS (
        SELECT DISTINCT ON (patient_id)
          patient_id,
          'DIAGNOSIS_RULED_OUT'::text AS milestone_type,
          (occurred_at AT TIME ZONE 'America/Lima')::date AS occurred_on,
          'patient_diagnostic_status_events'::text AS source_table,
          id AS source_id,
          follow_up_id
        FROM patient_diagnostic_status_events
        WHERE status = 'RULED_OUT'
        ORDER BY patient_id, occurred_at ASC, created_at ASC, id ASC
      ),
      treatment_started AS (
        SELECT DISTINCT ON (patient_id)
          patient_id,
          'TREATMENT_STARTED'::text AS milestone_type,
          start_date AS occurred_on,
          'patient_treatments'::text AS source_table,
          id AS source_id,
          follow_up_id
        FROM patient_treatments
        WHERE start_date IS NOT NULL
        ORDER BY patient_id, start_date ASC, created_at ASC, id ASC
      )
      SELECT * FROM symptoms_onset
      UNION ALL SELECT * FROM first_primary_care
      UNION ALL SELECT * FROM diagnosis_confirmed
      UNION ALL SELECT * FROM diagnosis_ruled_out
      UNION ALL SELECT * FROM treatment_started
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS patient_clinical_milestones`);
    await queryRunner.query(
      `ALTER TABLE "treatment_medications" DROP CONSTRAINT IF EXISTS "FK_treatment_medications_follow_up_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP CONSTRAINT IF EXISTS "FK_patient_medical_appointments_referred_health_center_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "patient_health_subcategory_history"`,
    );
    await queryRunner.query(
      `ALTER TABLE "treatment_medications" DROP COLUMN IF EXISTS "follow_up_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "treatment_medications" DROP COLUMN IF EXISTS "is_current"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP COLUMN IF EXISTS "referred_health_center_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP COLUMN IF EXISTS "specialty_other"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP COLUMN IF EXISTS "next_appointment_specialty_other"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN IF EXISTS "treatment_type_other"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" DROP COLUMN IF EXISTS "diagnosis_other"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_diagnoses" DROP COLUMN IF EXISTS "diagnosis_specialty_other"`,
    );
  }

  private async upsertCatalogItems(queryRunner: QueryRunner): Promise<void> {
    const inserts: Array<{
      kind: string;
      code: string;
      label: string;
      sortOrder: number;
      metadata: string;
    }> = [
      {
        kind: 'medical_specialty',
        code: 'MEDICINA_GENERAL',
        label: 'Medicina general',
        sortOrder: 150,
        metadata: JSON.stringify({ aliases: ['Medicina General'] }),
      },
      {
        kind: 'medical_specialty',
        code: 'MEDICINA_FAMILIAR',
        label: 'Medicina familiar',
        sortOrder: 160,
        metadata: '{}',
      },
      {
        kind: 'medical_specialty',
        code: 'OTRO',
        label: 'Otra especialidad',
        sortOrder: 900,
        metadata: '{}',
      },
      {
        kind: 'cancer_diagnosis',
        code: 'SARCOMA',
        label: 'Sarcoma',
        sortOrder: 230,
        metadata: '{}',
      },
      {
        kind: 'cancer_diagnosis',
        code: 'ESOFAGO',
        label: 'Cáncer de esófago',
        sortOrder: 240,
        metadata: '{}',
      },
    ];
    for (const item of inserts) {
      await queryRunner.query(
        `INSERT INTO catalog_items (kind, code, label, sort_order, is_active, is_system, metadata)
         VALUES ($1, $2, $3, $4, true, false, $5::jsonb)
         ON CONFLICT (kind, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order`,
        [item.kind, item.code, item.label, item.sortOrder, item.metadata],
      );
    }

    const aliasUpdates: Array<[string, string, string[]]> = [
      ['medical_specialty', 'ONCOLOGIA_MEDICA', ['Oncología', 'ONCOLOGY', 'Oncologia']],
      ['cancer_diagnosis', 'MAMA_DUCTAL', ['Cáncer de mama', 'Cancer de mama', 'Breast cancer']],
      ['cancer_diagnosis', 'GASTRICO', ['Cáncer de estómago', 'Cáncer de estómago avanzado']],
      ['cancer_diagnosis', 'COLON', ['Cáncer de colon y recto']],
      ['cancer_diagnosis', 'PULMON_NO_MICROCITICO', ['Cáncer de pulmón']],
      ['cancer_diagnosis', 'TIROIDES_PAPILAR', ['Cáncer de tiroides', 'Thyroid cancer']],
      ['cancer_diagnosis', 'OTRO', ['Cancer diagnosis', 'Rollback diagnosis']],
      ['treatment_type', 'QUIMIOTERAPIA', ['Chemotherapy', 'Quimioterapia neoadyuvante', 'Quimioterapia adyuvante']],
      ['treatment_type', 'RADIOTERAPIA', ['Radiotherapy', 'Radioterapia']],
      ['treatment_type', 'CIRUGIA', ['Surgery', 'Mastectomía', 'Prostatectomía', 'Hemicolectomía']],
    ];
    for (const [kind, code, aliases] of aliasUpdates) {
      await queryRunner.query(
        `UPDATE catalog_items
         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{aliases}', $3::jsonb)
         WHERE kind = $1 AND code = $2`,
        [kind, code, JSON.stringify(aliases)],
      );
    }
  }

  private async normalizeColumn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    otherColumn: string | null,
    kind: string,
    lookup: Map<string, Map<string, string>>,
    skipEmpty = false,
  ): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT id, "${column}" AS value FROM "${table}" WHERE "${column}" IS NOT NULL`,
    )) as Array<{ id: string; value: string }>;
    const map = lookup.get(kind) ?? new Map<string, string>();
    for (const row of rows) {
      if (!row.value?.trim()) continue;
      const code = map.get(normalizeKey(row.value));
      if (code) {
        if (otherColumn && code === 'OTRO') {
          await queryRunner.query(
            `UPDATE "${table}" SET "${column}" = $1, "${otherColumn}" = COALESCE("${otherColumn}", $2) WHERE id = $3`,
            [code, row.value, row.id],
          );
        } else {
          await queryRunner.query(
            `UPDATE "${table}" SET "${column}" = $1 WHERE id = $2`,
            [code, row.id],
          );
        }
      } else if (!skipEmpty) {
        if (otherColumn) {
          await queryRunner.query(
            `UPDATE "${table}" SET "${column}" = 'OTRO', "${otherColumn}" = $1 WHERE id = $2`,
            [row.value, row.id],
          );
        }
      }
    }
  }

  private async backfillDiagnosticOwnership(
    queryRunner: QueryRunner,
    lookup: Map<string, Map<string, string>>,
  ): Promise<void> {
    const cancer = lookup.get('cancer_diagnosis') ?? new Map<string, string>();
    const treatments = lookup.get('treatment_type') ?? new Map<string, string>();
    const reports = (await queryRunner.query(`
      SELECT
        id,
        patient_id,
        follow_up_id,
        enrollment_id,
        has_received_diagnosis,
        reported_diagnosis,
        is_receiving_reported_treatment,
        reported_treatment,
        created_at,
        health_center_id,
        specialty
      FROM patient_symptom_reports
      WHERE has_received_diagnosis IS NOT NULL
    `)) as Array<{
      id: string;
      patient_id: string;
      follow_up_id: string;
      enrollment_id: string | null;
      has_received_diagnosis: boolean;
      reported_diagnosis: string | null;
      is_receiving_reported_treatment: boolean | null;
      reported_treatment: string | null;
      created_at: Date;
      health_center_id: string | null;
      specialty: string | null;
    }>;

    for (const report of reports) {
      const existingEvents = (await queryRunner.query(
        `SELECT id, status FROM patient_diagnostic_status_events WHERE follow_up_id = $1`,
        [report.follow_up_id],
      )) as Array<{ id: string; status: string }>;
      const diagnosisCode = report.reported_diagnosis
        ? cancer.get(normalizeKey(report.reported_diagnosis))
        : undefined;

      if (report.has_received_diagnosis && report.reported_diagnosis) {
        if (diagnosisCode && diagnosisCode !== 'OTRO') {
          if (!existingEvents.some((event) => event.status === 'CONFIRMED')) {
            const existingDiagnosis = (await queryRunner.query(
              `SELECT id FROM patient_diagnoses WHERE follow_up_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [report.follow_up_id],
            )) as Array<{ id: string }>;
            let diagnosisId = existingDiagnosis[0]?.id ?? null;
            if (!diagnosisId) {
              const inserted = (await queryRunner.query(
                `INSERT INTO patient_diagnoses (
                   patient_id, follow_up_id, diagnosis, health_center_id,
                   diagnosis_specialty, is_current, created_at
                 ) VALUES ($1, $2, $3, $4, $5, true, $6)
                 RETURNING id`,
                [
                  report.patient_id,
                  report.follow_up_id,
                  diagnosisCode,
                  report.health_center_id,
                  report.specialty,
                  report.created_at,
                ],
              )) as Array<{ id: string }>;
              diagnosisId = inserted[0]?.id ?? null;
            }
            await queryRunner.query(
              `INSERT INTO patient_diagnostic_status_events (
                 patient_id, follow_up_id, status, occurred_at, reported_diagnosis, diagnosis_id, created_at
               ) VALUES ($1, $2, 'CONFIRMED', $3, $4, $5, $3)`,
              [
                report.patient_id,
                report.follow_up_id,
                report.created_at,
                diagnosisCode,
                diagnosisId,
              ],
            );
            if (
              report.is_receiving_reported_treatment === true &&
              report.reported_treatment &&
              diagnosisId
            ) {
              const existingTreatment = (await queryRunner.query(
                `SELECT id FROM patient_treatments WHERE follow_up_id = $1 LIMIT 1`,
                [report.follow_up_id],
              )) as Array<{ id: string }>;
              if (!existingTreatment.length) {
                const treatmentCode =
                  treatments.get(normalizeKey(report.reported_treatment)) ??
                  'OTRO';
                await queryRunner.query(
                  `INSERT INTO patient_treatments (
                     patient_id, follow_up_id, diagnosis_id, series_id, treatment_type,
                     treatment_type_other, is_current, is_referred, created_at
                   ) VALUES ($1, $2, $3, gen_random_uuid(), $4, $5, true, false, $6)`,
                  [
                    report.patient_id,
                    report.follow_up_id,
                    diagnosisId,
                    treatmentCode,
                    treatmentCode === 'OTRO' ? report.reported_treatment : null,
                    report.created_at,
                  ],
                );
              }
            }
          }
        } else if (!existingEvents.some((event) => event.status === 'RULED_OUT')) {
          const eventRows = (await queryRunner.query(
            `INSERT INTO patient_diagnostic_status_events (
               patient_id, follow_up_id, status, occurred_at, reported_diagnosis, diagnosis_id, created_at
             ) VALUES ($1, $2, 'RULED_OUT', $3, $4, NULL, $3)
             RETURNING id`,
            [
              report.patient_id,
              report.follow_up_id,
              report.created_at,
              report.reported_diagnosis,
            ],
          )) as Array<{ id: string }>;
          const existingNonOnc = (await queryRunner.query(
            `SELECT id FROM patient_non_oncological_follow_ups WHERE follow_up_id = $1 LIMIT 1`,
            [report.follow_up_id],
          )) as Array<{ id: string }>;
          if (!existingNonOnc.length) {
            await queryRunner.query(
              `INSERT INTO patient_non_oncological_follow_ups (
                 patient_id, follow_up_id, enrollment_id, diagnostic_status_event_id,
                 diagnosis, occurred_on, receives_treatment, treatment_name, status, created_at, updated_at
               ) VALUES ($1, $2, $3, $4, $5, ($6 AT TIME ZONE 'America/Lima')::date, $7, $8, 'ACTIVE', $6, $6)`,
              [
                report.patient_id,
                report.follow_up_id,
                report.enrollment_id,
                eventRows[0]?.id ?? null,
                report.reported_diagnosis,
                report.created_at,
                report.is_receiving_reported_treatment,
                report.is_receiving_reported_treatment === true
                  ? report.reported_treatment
                  : null,
              ],
            );
          }
        }
      } else if (!existingEvents.length) {
        await queryRunner.query(
          `INSERT INTO patient_diagnostic_status_events (
             patient_id, follow_up_id, status, occurred_at, reported_diagnosis, diagnosis_id, created_at
           ) VALUES ($1, $2, 'SEARCHING', $3, $4, NULL, $3)`,
          [
            report.patient_id,
            report.follow_up_id,
            report.created_at,
            report.reported_diagnosis,
          ],
        );
      }
    }
  }
}
