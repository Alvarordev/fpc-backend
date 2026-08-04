import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientTimelineIndexes1784865000000 implements MigrationInterface {
  name = 'AddPatientTimelineIndexes1784865000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_follow_ups_patient_occurred_timeline"
       ON "follow_ups" (
         "subject_patient_id",
         COALESCE("completed_at", "scheduled_at", "created_at") DESC,
         "id" DESC
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_patient_due_timeline"
       ON "reminders" ("subject_patient_id", "due_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_psychooncology_appointments_patient_scheduled_timeline"
       ON "psychooncology_appointments" ("patient_id", "scheduled_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_psychooncology_appointments_volunteer_patient"
       ON "psychooncology_appointments" ("volunteer_id", "patient_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_psychooncology_appointments_volunteer_patient"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_psychooncology_appointments_patient_scheduled_timeline"',
    );
    await queryRunner.query('DROP INDEX "IDX_reminders_patient_due_timeline"');
    await queryRunner.query(
      'DROP INDEX "IDX_follow_ups_patient_occurred_timeline"',
    );
  }
}
