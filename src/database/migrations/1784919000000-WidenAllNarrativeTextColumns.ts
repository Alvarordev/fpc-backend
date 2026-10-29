import { MigrationInterface, QueryRunner } from 'typeorm';

// Frozen inventory of user-entered narrative columns. Include columns already
// declared as text: older databases may still have varchar(255) definitions.
const NARRATIVE_COLUMNS: Record<string, string[]> = {
  alert_events: ['title', 'description'],
  alerts: ['title', 'description', 'ai_summary', 'derivation_notes'],
  enrollment_family_talk_interests: ['talk_name'],
  enrollments: [
    'not_attending_consultations_note',
    'not_receiving_treatment_reason',
    'case_comments',
  ],
  follow_ups: ['notes'],
  patient_addresses: [
    'address',
    'reference',
    'location_url',
    'location_share_status_other',
    'housing_type_other',
    'shelter_name',
  ],
  patient_details: [
    'program_dropout_reason',
    'transportation_sepa_provider_other',
    'shelter_sepa_provider_other',
  ],
  patient_diagnosis_revisions: ['change_reason'],
  patient_diagnoses: [
    'diagnosis',
    'diagnosis_other',
    'diagnosis_specialty_other',
    'symptom_leading_to_checkup',
    'disease_evolution',
    'change_reason',
  ],
  patient_diagnostic_status_events: ['reported_diagnosis', 'notes'],
  patient_documents: ['description'],
  patient_active_comorbidities: ['condition_name', 'treatment_description'],
  patient_limitations: ['description'],
  patient_family_cancer_history: ['relationship', 'cancer_type'],
  patient_insurance: ['change_reason'],
  patient_medical_appointments: [
    'specialty_other',
    'next_appointment_specialty_other',
    'referred_to',
    'referral_not_provided_reason',
    'difficulties',
    'change_reason',
  ],
  patient_non_oncological_follow_ups: [
    'diagnosis',
    'treatment_name',
    'medication',
    'discharge_reason',
  ],
  patient_sis_affiliation: ['cant_affiliate_reason', 'comments'],
  patient_social_notes: ['note'],
  patient_summaries: ['summary'],
  patient_symptom_reports: [
    'discomfort_description',
    'checkup_motivation',
    'signs_and_symptoms',
    'indications_received',
    'pain_location',
    'pain_description',
    'no_medical_consultation_reason',
    'referral_not_provided_reason',
    'consultation_not_obtained_reason',
    'reported_diagnosis',
    'reported_treatment',
    'not_receiving_treatment_reason',
  ],
  patient_treatments: [
    'treatment_type_other',
    'change_reason',
    'not_receiving_reason',
    'operation_name',
    'teleconsultation_note',
    'teleconsultation_specialties',
    'treatment_abandonment_reason',
    'interruption_reason_other',
    'access_barrier_other',
  ],
  patients: ['deactivation_reason_detail'],
  psychooncology_appointments: [
    'zoom_link',
    'topic_addressed',
    'session_details',
    'additional_observations',
    'recommendations',
    'scheduling_notes',
    'no_answer_note',
    'satisfaction_comment',
  ],
  reminders: ['description'],
  treatment_medications: ['name', 'dose_description', 'notes'],
  volunteers: ['additional_comments'],
};

export class WidenAllNarrativeTextColumns1784919000000 implements MigrationInterface {
  name = 'WidenAllNarrativeTextColumns1784919000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, columns] of Object.entries(NARRATIVE_COLUMNS)) {
      const boundedColumns = (await queryRunner.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1
           AND column_name = ANY($2::text[])
           AND data_type = 'character varying'`,
        [table, columns],
      )) as Array<{ column_name: string }>;
      if (boundedColumns.length === 0) continue;
      const alterations = boundedColumns.map(
        ({ column_name }) => `ALTER COLUMN "${column_name}" TYPE text`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ${alterations.join(', ')}`,
      );
    }
  }

  down(): Promise<void> {
    // Reintroducing a length limit could fail or destroy accepted clinical data.
    return Promise.reject(
      new Error(
        'This migration cannot be reverted safely: narrative text may exceed the former limits.',
      ),
    );
  }
}
