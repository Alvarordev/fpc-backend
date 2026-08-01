import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameInteractionsToFollowUps1784864000000 implements MigrationInterface {
  name = 'RenameInteractionsToFollowUps1784864000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "interactions" RENAME TO "follow_ups"');

    for (const [table, from, to] of COLUMN_RENAMES) {
      await q.query(
        `ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}"`,
      );
    }

    for (const [table, from, to] of CONSTRAINT_RENAMES) {
      await q.query(
        `ALTER TABLE "${table}" RENAME CONSTRAINT "${from}" TO "${to}"`,
      );
    }

    for (const [from, to] of INDEX_RENAMES) {
      await q.query(`ALTER INDEX "${from}" RENAME TO "${to}"`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const [from, to] of [...INDEX_RENAMES].reverse()) {
      await q.query(`ALTER INDEX "${to}" RENAME TO "${from}"`);
    }

    for (const [table, from, to] of [...CONSTRAINT_RENAMES].reverse()) {
      await q.query(
        `ALTER TABLE "${table}" RENAME CONSTRAINT "${to}" TO "${from}"`,
      );
    }

    for (const [table, from, to] of [...COLUMN_RENAMES].reverse()) {
      await q.query(
        `ALTER TABLE "${table}" RENAME COLUMN "${to}" TO "${from}"`,
      );
    }

    await q.query('ALTER TABLE "follow_ups" RENAME TO "interactions"');
  }
}

const COLUMN_RENAMES = [
  ['follow_ups', 'next_interaction_id', 'next_follow_up_id'],
  ['reminders', 'created_from_interaction_id', 'created_from_follow_up_id'],
  ['reminders', 'resulting_interaction_id', 'resulting_follow_up_id'],
  ['psychooncology_appointments', 'interaction_id', 'follow_up_id'],
  ['alerts', 'interaction_id', 'follow_up_id'],
  ['patient_insurance', 'interaction_id', 'follow_up_id'],
  ['patient_diagnoses', 'interaction_id', 'follow_up_id'],
  ['patient_treatments', 'interaction_id', 'follow_up_id'],
  ['patient_medical_appointments', 'interaction_id', 'follow_up_id'],
  ['patient_sis_affiliation', 'interaction_id', 'follow_up_id'],
  ['enrollments', 'interaction_id', 'follow_up_id'],
  ['enrollments', 'interaction_quality_rating', 'follow_up_quality_rating'],
  ['patient_symptom_reports', 'interaction_id', 'follow_up_id'],
] as const;

const CONSTRAINT_RENAMES = [
  ['follow_ups', 'PK_interactions', 'PK_follow_ups'],
  ['follow_ups', 'CHK_interactions_type', 'CHK_follow_ups_type'],
  ['follow_ups', 'CHK_interactions_status', 'CHK_follow_ups_status'],
  ['follow_ups', 'CHK_interactions_purpose', 'CHK_follow_ups_purpose'],
  ['follow_ups', 'FK_interactions_subject', 'FK_follow_ups_subject'],
  ['follow_ups', 'FK_interactions_interlocutor', 'FK_follow_ups_interlocutor'],
  ['follow_ups', 'FK_interactions_agent', 'FK_follow_ups_agent'],
  ['follow_ups', 'FK_interactions_next', 'FK_follow_ups_next'],
  [
    'psychooncology_appointments',
    'psychooncology_appointments_interaction_id_fkey',
    'psychooncology_appointments_follow_up_id_fkey',
  ],
  ['alerts', 'alerts_interaction_id_fkey', 'alerts_follow_up_id_fkey'],
  [
    'patient_insurance',
    'patient_insurance_interaction_id_fkey',
    'patient_insurance_follow_up_id_fkey',
  ],
  [
    'patient_diagnoses',
    'patient_diagnoses_interaction_id_fkey',
    'patient_diagnoses_follow_up_id_fkey',
  ],
  [
    'patient_treatments',
    'patient_treatments_interaction_id_fkey',
    'patient_treatments_follow_up_id_fkey',
  ],
  [
    'patient_medical_appointments',
    'patient_medical_appointments_interaction_id_fkey',
    'patient_medical_appointments_follow_up_id_fkey',
  ],
  [
    'patient_sis_affiliation',
    'patient_sis_affiliation_interaction_id_fkey',
    'patient_sis_affiliation_follow_up_id_fkey',
  ],
  [
    'enrollments',
    'enrollments_interaction_id_fkey',
    'enrollments_follow_up_id_fkey',
  ],
  [
    'patient_symptom_reports',
    'patient_symptom_reports_interaction_id_fkey',
    'patient_symptom_reports_follow_up_id_fkey',
  ],
] as const;

const INDEX_RENAMES = [
  ['IDX_interactions_subject_patient_id', 'IDX_follow_ups_subject_patient_id'],
  ['IDX_interactions_interlocutor_id', 'IDX_follow_ups_interlocutor_id'],
  ['IDX_interactions_agent_id', 'IDX_follow_ups_agent_id'],
  ['IDX_interactions_next_interaction_id', 'IDX_follow_ups_next_follow_up_id'],
  ['IDX_interactions_status', 'IDX_follow_ups_status'],
  [
    'IDX_reminders_created_from_interaction_id',
    'IDX_reminders_created_from_follow_up_id',
  ],
  [
    'IDX_reminders_resulting_interaction_id',
    'IDX_reminders_resulting_follow_up_id',
  ],
  [
    'IDX_psychooncology_appointments_interaction_id',
    'IDX_psychooncology_appointments_follow_up_id',
  ],
  ['IDX_alerts_interaction_id', 'IDX_alerts_follow_up_id'],
  [
    'IDX_patient_insurance_interaction_id',
    'IDX_patient_insurance_follow_up_id',
  ],
  [
    'IDX_patient_diagnoses_interaction_id',
    'IDX_patient_diagnoses_follow_up_id',
  ],
  [
    'IDX_patient_treatments_interaction_id',
    'IDX_patient_treatments_follow_up_id',
  ],
  [
    'IDX_patient_medical_appointments_interaction_id',
    'IDX_patient_medical_appointments_follow_up_id',
  ],
  [
    'IDX_patient_sis_affiliation_interaction_id',
    'IDX_patient_sis_affiliation_follow_up_id',
  ],
  ['IDX_enrollments_interaction_id', 'IDX_enrollments_follow_up_id'],
  [
    'IDX_patient_symptom_reports_interaction_id',
    'IDX_patient_symptom_reports_follow_up_id',
  ],
] as const;
