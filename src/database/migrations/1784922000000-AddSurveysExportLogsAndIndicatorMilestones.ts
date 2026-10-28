import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Surveys (EN1) with the ratings already stored on enrollments and
 * psycho-oncology sessions, export_logs (X2), and clinical milestones that
 * only use clinical dates (F7–F9).
 */
const MILESTONES_VIEW = `
  CREATE VIEW patient_clinical_milestones AS
  WITH symptoms_onset AS (
    SELECT DISTINCT ON (diagnosis.patient_id)
      diagnosis.patient_id,
      'SYMPTOMS_ONSET'::text AS milestone_type,
      diagnosis.first_symptoms_date AS occurred_on,
      'patient_diagnoses'::text AS source_table,
      diagnosis.id AS source_id,
      diagnosis.follow_up_id
    FROM patient_diagnoses diagnosis
    WHERE diagnosis.first_symptoms_date IS NOT NULL
    ORDER BY diagnosis.patient_id, diagnosis.first_symptoms_date ASC, diagnosis.id ASC
  ),
  first_primary_care AS (
    SELECT DISTINCT ON (symptom.patient_id)
      symptom.patient_id,
      'FIRST_PRIMARY_CARE'::text AS milestone_type,
      symptom.first_primary_care_via_sepa_at AS occurred_on,
      'patient_symptom_reports'::text AS source_table,
      symptom.id AS source_id,
      symptom.follow_up_id
    FROM patient_symptom_reports symptom
    WHERE symptom.first_primary_care_via_sepa_at IS NOT NULL
    ORDER BY symptom.patient_id, symptom.first_primary_care_via_sepa_at ASC, symptom.id ASC
  ),
  first_confirmation AS (
    SELECT DISTINCT ON (event.patient_id)
      event.patient_id,
      event.diagnosis_id,
      COALESCE(
        diagnosis.diagnosis_date,
        (event.occurred_at AT TIME ZONE 'America/Lima')::date
      ) AS occurred_on,
      event.id AS source_id,
      event.follow_up_id
    FROM patient_diagnostic_status_events event
    LEFT JOIN patient_diagnoses diagnosis ON diagnosis.id = event.diagnosis_id
    WHERE event.status = 'CONFIRMED'
    ORDER BY event.patient_id, event.occurred_at ASC, event.created_at ASC, event.id ASC
  ),
  diagnosis_confirmed AS (
    SELECT patient_id, 'DIAGNOSIS_CONFIRMED'::text AS milestone_type, occurred_on,
      'patient_diagnostic_status_events'::text AS source_table, source_id, follow_up_id
    FROM first_confirmation
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
    SELECT DISTINCT ON (treatment.patient_id)
      treatment.patient_id,
      'TREATMENT_STARTED'::text AS milestone_type,
      treatment.start_date AS occurred_on,
      'patient_treatments'::text AS source_table,
      treatment.id AS source_id,
      treatment.follow_up_id
    FROM patient_treatments treatment
    JOIN first_confirmation confirmation
      ON confirmation.patient_id = treatment.patient_id
     AND confirmation.diagnosis_id = treatment.diagnosis_id
    WHERE treatment.start_date IS NOT NULL
    ORDER BY treatment.patient_id, treatment.start_date ASC, treatment.id ASC
  )
  SELECT * FROM symptoms_onset
  UNION ALL SELECT * FROM first_primary_care
  UNION ALL SELECT * FROM diagnosis_confirmed
  UNION ALL SELECT * FROM diagnosis_ruled_out
  UNION ALL SELECT * FROM treatment_started
`;

export class AddSurveysExportLogsAndIndicatorMilestones1784922000000 implements MigrationInterface {
  name = 'AddSurveysExportLogsAndIndicatorMilestones1784922000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "surveys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
        "type" varchar(20) NOT NULL CHECK ("type" IN ('ENROLLMENT', 'THREE_MONTHS', 'PSYCHOONCOLOGY', 'TALK')),
        "rating" smallint NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
        "comment" text,
        "channel" varchar(20) NOT NULL CHECK ("channel" IN ('CALL', 'WHATSAPP', 'VIDEO_CALL', 'EMAIL', 'IN_PERSON', 'FORM')),
        "answered_at" timestamptz NOT NULL,
        "follow_up_id" uuid REFERENCES "follow_ups"("id") ON DELETE SET NULL,
        "psychooncology_appointment_id" uuid REFERENCES "psychooncology_appointments"("id") ON DELETE SET NULL,
        "actor_user_id" uuid REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CHECK ("psychooncology_appointment_id" IS NULL OR "type" = 'PSYCHOONCOLOGY')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_surveys_patient_type" ON "surveys" ("patient_id", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_surveys_answered_at" ON "surveys" ("answered_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_surveys_psychooncology_appointment" ON "surveys" ("psychooncology_appointment_id") WHERE "psychooncology_appointment_id" IS NOT NULL`,
    );

    // Existing ratings. 0 meant "not indicated" on enrollments and is skipped.
    await queryRunner.query(`
      INSERT INTO surveys (patient_id, type, rating, channel, answered_at, follow_up_id, created_at)
      SELECT
        enrollment.patient_id,
        'ENROLLMENT',
        enrollment.follow_up_quality_rating,
        CASE follow_up.type
          WHEN 'WHATSAPP' THEN 'WHATSAPP'
          WHEN 'VIDEO_CALL' THEN 'VIDEO_CALL'
          WHEN 'EMAIL' THEN 'EMAIL'
          WHEN 'IN_PERSON' THEN 'IN_PERSON'
          ELSE 'CALL'
        END,
        COALESCE(
          enrollment.call_ended_at,
          enrollment.enrolled_on::timestamp AT TIME ZONE 'America/Lima',
          enrollment.created_at
        ),
        enrollment.follow_up_id,
        now()
      FROM enrollments enrollment
      LEFT JOIN follow_ups follow_up ON follow_up.id = enrollment.follow_up_id
      WHERE enrollment.follow_up_quality_rating BETWEEN 1 AND 5
    `);
    await queryRunner.query(`
      INSERT INTO surveys (
        patient_id, type, rating, comment, channel, answered_at,
        follow_up_id, psychooncology_appointment_id, created_at
      )
      SELECT
        appointment.patient_id,
        'PSYCHOONCOLOGY',
        appointment.satisfaction_rating,
        NULLIF(BTRIM(appointment.satisfaction_comment), ''),
        'CALL',
        COALESCE(
          appointment.completed_at,
          appointment.completed_on::timestamp AT TIME ZONE 'America/Lima',
          appointment.updated_at
        ),
        appointment.follow_up_id,
        appointment.id,
        now()
      FROM psychooncology_appointments appointment
      WHERE appointment.satisfaction_rating BETWEEN 1 AND 5
    `);
    await queryRunner.query(
      `CREATE TRIGGER "audit_surveys" AFTER INSERT OR UPDATE OR DELETE ON "surveys"
       FOR EACH ROW EXECUTE FUNCTION audit_row_change('patient_id')`,
    );

    await queryRunner.query(`
      CREATE TABLE "export_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "filters" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "row_counts" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_export_logs_created_at" ON "export_logs" ("created_at")`,
    );

    await queryRunner.query(`DROP VIEW IF EXISTS patient_clinical_milestones`);
    await queryRunner.query(MILESTONES_VIEW);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // The previous milestones view used registration dates; it is not restored.
    await queryRunner.query('DROP TABLE "export_logs"');
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "audit_surveys" ON "surveys"',
    );
    await queryRunner.query('DROP TABLE "surveys"');
  }
}
