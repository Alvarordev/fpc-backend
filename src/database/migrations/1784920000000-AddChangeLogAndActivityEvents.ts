import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Field-level history of every patient record (change_log), filled by a
 * trigger so no write path can skip it, plus patient_activity_events so a
 * reactivation no longer erases the deactivation it undoes.
 *
 * Trigger arguments: the column holding the patient id, and optionally a
 * parent table to resolve it through (child rows of an assessment, ...).
 */
const AUDITED_TABLES: [
  table: string,
  patientColumn: string,
  parent?: string,
][] = [
  ['patients', 'id'],
  ['patient_details', 'patient_id'],
  ['patient_addresses', 'patient_id'],
  ['companion_patient', 'patient_id'],
  ['follow_ups', 'subject_patient_id'],
  ['reminders', 'subject_patient_id'],
  ['enrollments', 'patient_id'],
  ['enrollment_family_talk_interests', 'enrollment_id', 'enrollments'],
  ['patient_insurance', 'patient_id'],
  ['patient_sis_affiliation', 'patient_id'],
  ['patient_diagnoses', 'patient_id'],
  ['patient_diagnostic_status_events', 'patient_id'],
  ['patient_treatments', 'patient_id'],
  ['treatment_medications', 'patient_id'],
  ['patient_medical_appointments', 'patient_id'],
  ['patient_symptom_reports', 'patient_id'],
  ['patient_health_background_assessments', 'patient_id'],
  [
    'patient_active_comorbidities',
    'assessment_id',
    'patient_health_background_assessments',
  ],
  [
    'patient_family_cancer_history',
    'assessment_id',
    'patient_health_background_assessments',
  ],
  [
    'patient_limitations',
    'assessment_id',
    'patient_health_background_assessments',
  ],
  ['patient_psychooncology_support_assessments', 'patient_id'],
  ['patient_non_oncological_follow_ups', 'patient_id'],
  ['patient_social_notes', 'patient_id'],
  ['patient_documents', 'patient_id'],
  ['psychooncology_appointments', 'patient_id'],
];

export class AddChangeLogAndActivityEvents1784920000000 implements MigrationInterface {
  name = 'AddChangeLogAndActivityEvents1784920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "change_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "change_set_id" uuid NOT NULL,
        "patient_id" uuid,
        "entity_type" varchar(80) NOT NULL,
        "entity_id" uuid NOT NULL,
        "operation" varchar(10) NOT NULL CHECK ("operation" IN ('INSERT', 'UPDATE', 'DELETE')),
        "field" varchar(80),
        "old_value" jsonb,
        "new_value" jsonb,
        "context" varchar(20) NOT NULL CHECK ("context" IN ('FOLLOW_UP', 'ADMIN_ADJUSTMENT', 'HISTORICAL_LOAD', 'SYSTEM')),
        "follow_up_id" uuid,
        "actor_user_id" uuid,
        "changed_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_change_log_patient_changed" ON "change_log" ("patient_id", "changed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_change_log_entity" ON "change_log" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_change_log_follow_up" ON "change_log" ("follow_up_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_change_log_change_set" ON "change_log" ("change_set_id")`,
    );

    // Shared by the trigger and by HistoryVersioningService.
    await queryRunner.query(`
      CREATE FUNCTION audit_write(
        p_patient_id uuid, p_entity_type text, p_entity_id uuid,
        p_operation text, p_field text, p_old jsonb, p_new jsonb
      ) RETURNS void LANGUAGE plpgsql AS $$
      DECLARE
        ctx jsonb := NULLIF(current_setting('app.audit', true), '')::jsonb;
      BEGIN
        INSERT INTO change_log (
          change_set_id, patient_id, entity_type, entity_id, operation, field,
          old_value, new_value, context, follow_up_id, actor_user_id
        ) VALUES (
          COALESCE((ctx ->> 'changeSetId')::uuid, md5('tx' || txid_current())::uuid),
          p_patient_id, p_entity_type, p_entity_id, p_operation, p_field,
          p_old, p_new,
          COALESCE(ctx ->> 'context', 'SYSTEM'),
          (ctx ->> 'followUpId')::uuid,
          (ctx ->> 'actorUserId')::uuid
        );
      END $$
    `);

    await queryRunner.query(`
      CREATE FUNCTION audit_row_change() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        ctx jsonb := NULLIF(current_setting('app.audit', true), '')::jsonb;
        old_row jsonb;
        new_row jsonb;
        row_data jsonb;
        patient uuid;
        key text;
      BEGIN
        IF COALESCE(ctx ->> 'suppress', 'off') = 'on' THEN
          RETURN NULL;
        END IF;
        IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
        IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
        row_data := COALESCE(new_row, old_row);

        IF TG_NARGS > 1 THEN
          EXECUTE format('SELECT patient_id FROM %I WHERE id = $1', TG_ARGV[1])
            INTO patient USING (row_data ->> TG_ARGV[0])::uuid;
        ELSE
          patient := (row_data ->> TG_ARGV[0])::uuid;
        END IF;

        IF TG_OP = 'UPDATE' THEN
          FOR key IN SELECT jsonb_object_keys(new_row) LOOP
            CONTINUE WHEN key IN ('created_at', 'updated_at')
              OR (old_row -> key) IS NOT DISTINCT FROM (new_row -> key);
            PERFORM audit_write(
              patient, TG_TABLE_NAME, (row_data ->> 'id')::uuid, 'UPDATE',
              key, old_row -> key, new_row -> key
            );
          END LOOP;
        ELSE
          PERFORM audit_write(
            patient, TG_TABLE_NAME, (row_data ->> 'id')::uuid, TG_OP,
            NULL, old_row, new_row
          );
        END IF;
        RETURN NULL;
      END $$
    `);

    for (const [table, column, parent] of AUDITED_TABLES) {
      const args = parent ? `'${column}', '${parent}'` : `'${column}'`;
      await queryRunner.query(
        `CREATE TRIGGER "audit_${table}" AFTER INSERT OR UPDATE OR DELETE ON "${table}"
         FOR EACH ROW EXECUTE FUNCTION audit_row_change(${args})`,
      );
    }

    // Diagnosis revisions become change_log rows. A revision kept only the
    // overwritten values (camelCase keys); the new value is the next
    // revision's old value or, for the last one, the current column.
    await queryRunner.query(`
      INSERT INTO change_log (
        change_set_id, patient_id, entity_type, entity_id, operation, field,
        old_value, new_value, context, follow_up_id, actor_user_id, changed_at
      )
      SELECT
        revision.id, diagnosis.patient_id, 'patient_diagnoses', diagnosis.id,
        'UPDATE', column_name.name, entry.value,
        COALESCE(
          (
            SELECT later.previous_values -> entry.key
            FROM patient_diagnosis_revisions later
            WHERE later.diagnosis_id = revision.diagnosis_id
              AND later.created_at > revision.created_at
              AND later.previous_values ? entry.key
            ORDER BY later.created_at
            LIMIT 1
          ),
          to_jsonb(diagnosis_row.*) -> column_name.name
        ),
        'FOLLOW_UP', revision.follow_up_id, revision.changed_by_id,
        revision.created_at
      FROM patient_diagnosis_revisions revision
      JOIN patient_diagnoses diagnosis ON diagnosis.id = revision.diagnosis_id
      -- patient_diagnoses has a "diagnosis" column, so the row needs its own alias.
      JOIN patient_diagnoses diagnosis_row ON diagnosis_row.id = revision.diagnosis_id
      CROSS JOIN LATERAL jsonb_each(revision.previous_values) entry
      CROSS JOIN LATERAL (
        SELECT lower(regexp_replace(entry.key, '([A-Z])', '_\\1', 'g')) AS name
      ) column_name
    `);
    await queryRunner.query(`
      INSERT INTO change_log (
        change_set_id, patient_id, entity_type, entity_id, operation, field,
        old_value, new_value, context, follow_up_id, actor_user_id, changed_at
      )
      SELECT
        revision.id, diagnosis.patient_id, 'patient_diagnoses', diagnosis.id,
        'UPDATE', 'change_reason', NULL, to_jsonb(revision.change_reason),
        'FOLLOW_UP', revision.follow_up_id, revision.changed_by_id,
        revision.created_at
      FROM patient_diagnosis_revisions revision
      JOIN patient_diagnoses diagnosis ON diagnosis.id = revision.diagnosis_id
    `);
    await queryRunner.query('DROP TABLE "patient_diagnosis_revisions"');

    await queryRunner.query(`
      CREATE TABLE "patient_activity_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
        "status" varchar(20) NOT NULL CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'REACTIVE')),
        "reason" varchar(30),
        "reason_detail" text,
        "deceased_at" date,
        "follow_up_id" uuid REFERENCES "follow_ups"("id"),
        "actor_user_id" uuid REFERENCES "users"("id"),
        "occurred_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CHECK (("status" = 'INACTIVE') = ("reason" IS NOT NULL))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_activity_events_patient_occurred" ON "patient_activity_events" ("patient_id", "occurred_at")`,
    );
    // Seed one event per patient from its current state. Deactivations that a
    // reactivation already erased cannot be recovered.
    await queryRunner.query(`
      INSERT INTO patient_activity_events (
        patient_id, status, reason, reason_detail, deceased_at, occurred_at
      )
      SELECT
        patient.id,
        patient.activity_status,
        patient.deactivation_reason,
        patient.deactivation_reason_detail,
        patient.deceased_at,
        CASE patient.activity_status
          WHEN 'INACTIVE' THEN patient.deactivated_at
          WHEN 'REACTIVE' THEN patient.updated_at
          ELSE COALESCE(
            (
              SELECT MIN(enrollment.enrolled_on::timestamp AT TIME ZONE 'America/Lima')
              FROM enrollments enrollment
              WHERE enrollment.patient_id = patient.id
            ),
            patient.created_at
          )
        END
      FROM patients patient
      WHERE patient.role = 'PATIENT'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "patient_activity_events"');
    for (const [table] of AUDITED_TABLES)
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS "audit_${table}" ON "${table}"`,
      );
    await queryRunner.query('DROP FUNCTION audit_row_change()');
    await queryRunner.query(
      'DROP FUNCTION audit_write(uuid, text, uuid, text, text, jsonb, jsonb)',
    );
    await queryRunner.query('DROP TABLE "change_log"');
    await queryRunner.query(
      `CREATE TABLE "patient_diagnosis_revisions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "diagnosis_id" uuid NOT NULL REFERENCES "patient_diagnoses"("id"), "follow_up_id" uuid NOT NULL REFERENCES "follow_ups"("id"), "changed_by_id" uuid REFERENCES "users"("id"), "change_reason" text NOT NULL, "previous_values" jsonb NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
  }
}
