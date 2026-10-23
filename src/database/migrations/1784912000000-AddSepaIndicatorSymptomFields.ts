import { MigrationInterface, QueryRunner } from 'typeorm';

const SEPA_CATALOG_ITEMS: Array<{
  kind: string;
  code: string;
  label: string;
  sortOrder: number;
}> = [
  {
    kind: 'sepa_transport',
    code: 'CRUZ_DEL_SUR',
    label: 'Cruz del Sur',
    sortOrder: 10,
  },
  {
    kind: 'sepa_transport',
    code: 'LATAM_AVION_SOLIDARIO',
    label: 'LATAM – Avión Solidario',
    sortOrder: 20,
  },
  {
    kind: 'sepa_transport',
    code: 'OTHER',
    label: 'Otro',
    sortOrder: 90,
  },
  {
    kind: 'sepa_shelter',
    code: 'FRIEDA_HELLER',
    label: 'Albergue Frieda Heller – FPC',
    sortOrder: 10,
  },
  {
    kind: 'sepa_shelter',
    code: 'CASA_MAGIA',
    label: 'Casa Magia',
    sortOrder: 20,
  },
  {
    kind: 'sepa_shelter',
    code: 'CASA_RONALD_MCDONALD',
    label: 'Casa Ronald McDonald',
    sortOrder: 30,
  },
  {
    kind: 'sepa_shelter',
    code: 'INSPIRA',
    label: 'Albergue Inspira',
    sortOrder: 40,
  },
  {
    kind: 'sepa_shelter',
    code: 'ALINEN',
    label: 'ALINEN',
    sortOrder: 50,
  },
  {
    kind: 'sepa_shelter',
    code: 'OTHER',
    label: 'Otro',
    sortOrder: 90,
  },
];

const PREVIOUS_FIRST_PRIMARY_CARE = `
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
      )
`;

const UPDATED_FIRST_PRIMARY_CARE = `
      first_primary_care AS (
        SELECT DISTINCT ON (patient_id)
          patient_id,
          'FIRST_PRIMARY_CARE'::text AS milestone_type,
          occurred_on,
          source_table,
          source_id,
          follow_up_id
        FROM (
          SELECT
            appointment.patient_id,
            appointment.appointment_date AS occurred_on,
            'patient_medical_appointments'::text AS source_table,
            appointment.id AS source_id,
            appointment.follow_up_id,
            appointment.is_first_consultation,
            appointment.created_at
          FROM patient_medical_appointments appointment
          WHERE appointment.appointment_date IS NOT NULL
          UNION ALL
          SELECT
            symptom.patient_id,
            symptom.first_primary_care_via_sepa_at AS occurred_on,
            'patient_symptom_reports'::text AS source_table,
            symptom.id AS source_id,
            symptom.follow_up_id,
            true AS is_first_consultation,
            symptom.created_at
          FROM patient_symptom_reports symptom
          WHERE symptom.first_primary_care_via_sepa_at IS NOT NULL
            AND symptom.attended_primary_care_via_sepa = true
        ) care
        ORDER BY patient_id, is_first_consultation DESC, occurred_on ASC, created_at ASC, source_id ASC
      )
`;

function clinicalMilestonesView(firstPrimaryCareCte: string): string {
  return `
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
      ${firstPrimaryCareCte},
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
  `;
}

export class AddSepaIndicatorSymptomFields1784912000000
  implements MigrationInterface
{
  name = 'AddSepaIndicatorSymptomFields1784912000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "referred_via_sepa" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "attended_primary_care_via_sepa" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_symptom_reports" ADD COLUMN "first_primary_care_via_sepa_at" date`,
    );

    await queryRunner.query(`DROP VIEW IF EXISTS patient_clinical_milestones`);
    await queryRunner.query(
      clinicalMilestonesView(UPDATED_FIRST_PRIMARY_CARE),
    );

    for (const item of SEPA_CATALOG_ITEMS) {
      await queryRunner.query(
        `INSERT INTO catalog_items (kind, code, label, sort_order, is_active, is_system)
         VALUES ($1, $2, $3, $4, true, true)
         ON CONFLICT (kind, code) DO UPDATE SET
           label = EXCLUDED.label,
           sort_order = EXCLUDED.sort_order,
           is_active = true,
           is_system = true,
           updated_at = now()`,
        [item.kind, item.code, item.label, item.sortOrder],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS patient_clinical_milestones`);
    await queryRunner.query(
      clinicalMilestonesView(PREVIOUS_FIRST_PRIMARY_CARE),
    );
    await queryRunner.query(
      `ALTER TABLE "patient_symptom_reports" DROP COLUMN "first_primary_care_via_sepa_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_symptom_reports" DROP COLUMN "attended_primary_care_via_sepa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_symptom_reports" DROP COLUMN "referred_via_sepa"`,
    );
  }
}
