import { MigrationInterface, QueryRunner } from 'typeorm';

const HISTORY_TABLES = [
  'patient_health_phase_history',
  'patient_health_subcategory_history',
] as const;

/** Noon in Lima for a date-only value, as the services store it. */
const limaNoon = (column: string) =>
  `((${column})::text || ' 12:00:00-05')::timestamptz`;

/**
 * Health phase/subcategory history rows used to default to the load time.
 * Rows written in the same transaction as their source share its `now()`, so
 * `changed_at = <source>.created_at` identifies them; they take the real
 * event date, matching what new loads store since the service fix.
 */
export class BackfillHealthHistoryEventDates1784917000000 implements MigrationInterface {
  name = 'BackfillHealthHistoryEventDates1784917000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of HISTORY_TABLES) {
      // Historical enrollments: the phase started on the enrollment date.
      const enrollments = (await queryRunner.query(
        `UPDATE "${table}" history
         SET changed_at = ${limaNoon('enrollment.enrolled_on')}
         FROM enrollments enrollment
         JOIN follow_ups follow_up ON follow_up.id = enrollment.follow_up_id
         WHERE enrollment.is_historical = true
           AND enrollment.patient_id = history.patient_id
           AND history.changed_at = follow_up.created_at
         RETURNING history.id`,
      )) as unknown[];

      // Diagnostic status transitions: when the status really changed.
      const statusEvents = (await queryRunner.query(
        `UPDATE "${table}" history
         SET changed_at = event.occurred_at
         FROM patient_diagnostic_status_events event
         WHERE event.patient_id = history.patient_id
           AND history.changed_at = event.created_at
           AND event.occurred_at <> event.created_at
         RETURNING history.id`,
      )) as unknown[];

      // Historical follow-ups: when the follow-up happened.
      const followUps = (await queryRunner.query(
        `UPDATE "${table}" history
         SET changed_at = COALESCE(
           follow_up.completed_at,
           follow_up.scheduled_at,
           ${limaNoon('follow_up.completed_on')},
           ${limaNoon('follow_up.scheduled_on')}
         )
         FROM follow_ups follow_up
         WHERE follow_up.is_historical = true
           AND follow_up.subject_patient_id = history.patient_id
           AND history.changed_at = follow_up.created_at
           AND COALESCE(
             follow_up.completed_at,
             follow_up.scheduled_at,
             follow_up.completed_on::timestamptz,
             follow_up.scheduled_on::timestamptz
           ) IS NOT NULL
         RETURNING history.id`,
      )) as unknown[];

      console.log(
        `[${this.name}] ${table}: ${countRows(enrollments)} from historical enrollments, ${countRows(statusEvents)} from diagnostic status events, ${countRows(followUps)} from historical follow-ups`,
      );
    }
  }

  public async down(): Promise<void> {
    // The original load times are not kept; the backfilled dates stay.
  }
}

/** The postgres driver returns `[rows, affected]` for UPDATE … RETURNING. */
function countRows(result: unknown[]): number {
  const [rows] = result;
  return Array.isArray(rows) ? rows.length : result.length;
}
