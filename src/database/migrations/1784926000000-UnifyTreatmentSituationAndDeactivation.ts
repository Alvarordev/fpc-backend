import { MigrationInterface, QueryRunner } from 'typeorm';

// [old code, old label, new code, new label]
const SITUATIONS: [string, string, string, string][] = [
  ['PENDIENTE_DE_INICIO', 'Pendiente de inicio', 'EN_ESPERA', 'En espera'],
  ['SEARCHING', 'En búsqueda', 'EN_BUSQUEDA', 'En búsqueda'],
  ['EN_CURSO', 'En curso', 'EN_PROCESO', 'En proceso'],
  ['FINALIZADO', 'Finalizado', 'CULMINADO', 'Culminado'],
  ['INTERRUMPIDO', 'Interrumpido', 'SUSPENDIDO', 'Suspendido'],
  ['REMISSION', 'Remisión', 'REMISION', 'En remisión'],
  ['ABANDONED', 'Abandonado', 'ABANDONADO', 'Abandonado'],
  [
    'DECEASED_DURING_TREATMENT',
    'Falleció durante el tratamiento',
    'FALLECIDO',
    'Fallecido',
  ],
  ['NOT_APPLICABLE', 'No aplica', 'NO_APLICA', 'No aplica'],
];

const DEACTIVATION_REASONS: [string, string][] = [
  ['WITHDREW_CONSENT', 'VOLUNTARY'],
  ['LOST_CONTACT', 'UNLOCATABLE'],
];

/**
 * - Treatment situations get the client's Spanish codes (D-c).
 * - Program dropout and deactivation become one reason (F14): the dropout
 *   columns of patient_details turn into INACTIVE activity events.
 * - patient_sis_affiliation is the only source of SIS-by-SEPA (F13).
 */
export class UnifyTreatmentSituationAndDeactivation1784926000000 implements MigrationInterface {
  name = 'UnifyTreatmentSituationAndDeactivation1784926000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE item record;
      BEGIN
        FOR item IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'patients'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%WITHDREW_CONSENT%'
        LOOP
          EXECUTE format('ALTER TABLE patients DROP CONSTRAINT %I', item.conname);
        END LOOP;
      END $$
    `);
    // Code renames are not real changes of the patient: keep them out of change_log.
    await queryRunner.query(
      `SELECT set_config('app.audit', '{"suppress":"on"}', true)`,
    );
    for (const [from, , to, label] of SITUATIONS) {
      await this.renameSituation(queryRunner, from, to, label, true);
    }
    for (const [from, to] of DEACTIVATION_REASONS) {
      await this.renameReason(queryRunner, from, to);
    }
    await queryRunner.query(`SELECT set_config('app.audit', '', true)`);

    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "CHK_patients_deactivation_reason" CHECK ("deactivation_reason" IN ('VOLUNTARY', 'UNLOCATABLE', 'DECEASED', 'TRANSFERRED_OUT', 'OTHER'))`,
    );
    await queryRunner.query(`
      INSERT INTO catalog_items (kind, code, label, sort_order, is_system)
      VALUES ('program_dropout_reason', 'TRANSFERRED_OUT', 'Transferido a otro programa', 40, true)
      ON CONFLICT (kind, code) DO NOTHING
    `);

    // Dropouts recorded only in patient_details become INACTIVE events.
    await queryRunner.query(`
      CREATE TEMP TABLE dropout_events ON COMMIT DROP AS
      SELECT
        details.patient_id,
        CASE
          WHEN details.program_dropout_reason_code IN ('VOLUNTARY', 'UNLOCATABLE', 'DECEASED')
            THEN details.program_dropout_reason_code
          ELSE 'OTHER'
        END AS reason,
        NULLIF(BTRIM(CONCAT_WS(': ',
          CASE
            WHEN details.program_dropout_reason_code IS NULL
              OR details.program_dropout_reason_code IN ('VOLUNTARY', 'UNLOCATABLE', 'DECEASED', 'OTHER')
              THEN NULL
            ELSE COALESCE(item.label, details.program_dropout_reason_code)
          END,
          NULLIF(BTRIM(details.program_dropout_reason), '')
        )), '') AS detail,
        CASE WHEN details.program_dropout_date IS NOT NULL
          THEN details.program_dropout_date::timestamp AT TIME ZONE 'America/Lima' + interval '12 hours'
          ELSE details.updated_at
        END AS occurred_at,
        details.program_dropout_date
      FROM patient_details details
      JOIN patients patient ON patient.id = details.patient_id
      LEFT JOIN catalog_items item
        ON item.kind = 'program_dropout_reason'
       AND item.code = details.program_dropout_reason_code
      WHERE patient.role = 'PATIENT'
        AND (
          details.program_dropout_reason_code IS NOT NULL
          OR details.program_dropout_date IS NOT NULL
          OR NULLIF(BTRIM(details.program_dropout_reason), '') IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM patient_activity_events event
          WHERE event.patient_id = details.patient_id
            AND event.status = 'INACTIVE'
        )
    `);
    await queryRunner.query(`
      INSERT INTO patient_activity_events (
        patient_id, status, reason, reason_detail, deceased_at, occurred_at
      )
      SELECT
        patient_id, 'INACTIVE', reason,
        CASE WHEN reason = 'OTHER' THEN COALESCE(detail, 'Sin motivo registrado') ELSE detail END,
        CASE WHEN reason = 'DECEASED' THEN program_dropout_date END,
        occurred_at
      FROM dropout_events
    `);
    // The patient cache follows its latest event: a dropout after the last
    // activation leaves the patient inactive.
    await queryRunner.query(`
      UPDATE patients patient
      SET activity_status = 'INACTIVE',
          deactivation_reason = dropout.reason,
          deactivation_reason_detail = CASE
            WHEN dropout.reason = 'OTHER' THEN COALESCE(dropout.detail, 'Sin motivo registrado')
          END,
          deactivated_at = dropout.occurred_at,
          deceased_at = CASE
            WHEN dropout.reason = 'DECEASED'
              THEN COALESCE(patient.deceased_at, dropout.program_dropout_date)
            ELSE patient.deceased_at
          END
      FROM dropout_events dropout
      WHERE dropout.patient_id = patient.id
        AND patient.activity_status IN ('ACTIVE', 'REACTIVE')
        AND NOT EXISTS (
          SELECT 1 FROM patient_activity_events later
          WHERE later.patient_id = patient.id
            AND later.status <> 'INACTIVE'
            AND later.occurred_at > dropout.occurred_at
        )
    `);
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP CONSTRAINT IF EXISTS "CHK_patient_details_program_dropout_reason_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "program_dropout_reason_code", DROP COLUMN "program_dropout_reason", DROP COLUMN "program_dropout_date"`,
    );

    // Re-enrollment (E6) allows several operational enrollments per patient.
    await queryRunner.query(
      `DROP INDEX "UQ_enrollments_patient_id_operational"`,
    );

    // SIS affiliations by SEPA flagged on the insurance move to patient_sis_affiliation.
    await queryRunner.query(`
      INSERT INTO patient_sis_affiliation (
        patient_id, follow_up_id, can_affiliate, affiliated_via_sepa, affiliated_at, comments
      )
      SELECT DISTINCT ON (insurance.patient_id)
        insurance.patient_id,
        insurance.follow_up_id,
        true,
        true,
        COALESCE(
          insurance.start_date::timestamp AT TIME ZONE 'America/Lima' + interval '12 hours',
          insurance.created_at
        ),
        'Migrado desde el seguro SIS marcado como afiliado por SEPA'
      FROM patient_insurance insurance
      WHERE insurance.insurance_type = 'SIS'
        AND insurance.affiliated_via_sepa = true
        AND NOT EXISTS (
          SELECT 1 FROM patient_sis_affiliation affiliation
          WHERE affiliation.patient_id = insurance.patient_id
            AND affiliation.affiliated_via_sepa = true
        )
      ORDER BY insurance.patient_id, insurance.start_date NULLS LAST, insurance.created_at
    `);
    await queryRunner.query(
      `UPDATE patient_insurance SET affiliated_via_sepa = NULL WHERE insurance_type <> 'ESSALUD' AND affiliated_via_sepa IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_enrollments_patient_id_operational" ON "enrollments" ("patient_id") WHERE "is_historical" = false`,
    );
    await queryRunner.query(`
      UPDATE patient_insurance insurance
      SET affiliated_via_sepa = true
      FROM patient_sis_affiliation affiliation
      WHERE affiliation.patient_id = insurance.patient_id
        AND affiliation.affiliated_via_sepa = true
        AND insurance.insurance_type = 'SIS'
    `);
    await queryRunner.query(
      `DELETE FROM patient_sis_affiliation WHERE comments = 'Migrado desde el seguro SIS marcado como afiliado por SEPA'`,
    );

    // Dropout columns come back empty; the events stay as the source.
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "program_dropout_reason" text, ADD COLUMN "program_dropout_date" date, ADD COLUMN "program_dropout_reason_code" character varying(100)`,
    );

    await queryRunner.query(
      `ALTER TABLE "patients" DROP CONSTRAINT "CHK_patients_deactivation_reason"`,
    );
    await queryRunner.query(
      `SELECT set_config('app.audit', '{"suppress":"on"}', true)`,
    );
    for (const [from, to] of DEACTIVATION_REASONS) {
      await this.renameReason(queryRunner, to, from);
    }
    for (const [from, label, to] of SITUATIONS) {
      await this.renameSituation(queryRunner, to, from, label, false);
    }
    await queryRunner.query(`SELECT set_config('app.audit', '', true)`);
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "CHK_patients_deactivation_reason" CHECK ("deactivation_reason" IN ('DECEASED', 'WITHDREW_CONSENT', 'LOST_CONTACT', 'TRANSFERRED_OUT', 'OTHER'))`,
    );
    await queryRunner.query(
      `DELETE FROM catalog_items WHERE kind = 'program_dropout_reason' AND code = 'TRANSFERRED_OUT'`,
    );
  }

  private async renameSituation(
    queryRunner: QueryRunner,
    from: string,
    to: string,
    label: string,
    keepAlias: boolean,
  ) {
    await queryRunner.query(
      `UPDATE patient_treatments SET treatment_situation = $2 WHERE treatment_situation = $1`,
      [from, to],
    );
    await this.renameInChangeLog(
      queryRunner,
      'patient_treatments',
      'treatment_situation',
      from,
      to,
    );
    // The previous code stays as an alias so old clients still resolve.
    await queryRunner.query(
      `UPDATE catalog_items
       SET code = $2,
           label = $3,
           metadata = CASE WHEN $4::boolean
             THEN jsonb_set(COALESCE(metadata, '{}'::jsonb), '{aliases}', jsonb_build_array($1::text))
             ELSE COALESCE(metadata, '{}'::jsonb) - 'aliases'
           END,
           updated_at = now()
       WHERE kind = 'treatment_situation' AND code = $1
         AND NOT EXISTS (
           SELECT 1 FROM catalog_items existing
           WHERE existing.kind = 'treatment_situation' AND existing.code = $2
         )`,
      [from, to, label, keepAlias],
    );
  }

  private async renameReason(
    queryRunner: QueryRunner,
    from: string,
    to: string,
  ) {
    await queryRunner.query(
      `UPDATE patients SET deactivation_reason = $2 WHERE deactivation_reason = $1`,
      [from, to],
    );
    await queryRunner.query(
      `UPDATE patient_activity_events SET reason = $2 WHERE reason = $1`,
      [from, to],
    );
    await this.renameInChangeLog(
      queryRunner,
      'patients',
      'deactivation_reason',
      from,
      to,
    );
  }

  private async renameInChangeLog(
    queryRunner: QueryRunner,
    entityType: string,
    field: string,
    from: string,
    to: string,
  ) {
    await queryRunner.query(
      `UPDATE change_log
       SET old_value = CASE WHEN old_value = to_jsonb($3::text) THEN to_jsonb($4::text) ELSE old_value END,
           new_value = CASE WHEN new_value = to_jsonb($3::text) THEN to_jsonb($4::text) ELSE new_value END
       WHERE entity_type = $1 AND field = $2
         AND (old_value = to_jsonb($3::text) OR new_value = to_jsonb($3::text))`,
      [entityType, field, from, to],
    );
    await queryRunner.query(
      `UPDATE change_log
       SET old_value = CASE WHEN old_value ->> $2 = $3 THEN jsonb_set(old_value, ARRAY[$2], to_jsonb($4::text)) ELSE old_value END,
           new_value = CASE WHEN new_value ->> $2 = $3 THEN jsonb_set(new_value, ARRAY[$2], to_jsonb($4::text)) ELSE new_value END
       WHERE entity_type = $1 AND field IS NULL
         AND (old_value ->> $2 = $3 OR new_value ->> $2 = $3)`,
      [entityType, field, from, to],
    );
  }
}
