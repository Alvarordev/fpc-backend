import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvailabilityAppointmentsAlertsIndexes1784860000000 implements MigrationInterface {
  name = 'AddAvailabilityAppointmentsAlertsIndexes1784860000000';

  async up(q: QueryRunner) {
    await q.query(
      'CREATE INDEX "IDX_volunteer_availability_volunteer_id" ON "volunteer_availability" ("volunteer_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_volunteer_availability_status" ON "volunteer_availability" ("status")',
    );
    await q.query(
      'CREATE INDEX "IDX_psychooncology_appointments_patient_id" ON "psychooncology_appointments" ("patient_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_psychooncology_appointments_volunteer_id" ON "psychooncology_appointments" ("volunteer_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_psychooncology_appointments_interaction_id" ON "psychooncology_appointments" ("interaction_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_psychooncology_appointments_availability_id" ON "psychooncology_appointments" ("availability_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_psychooncology_appointments_status" ON "psychooncology_appointments" ("status")',
    );
    await q.query(
      'CREATE INDEX "IDX_alerts_health_center_id" ON "alerts" ("health_center_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_alerts_interaction_id" ON "alerts" ("interaction_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_alerts_created_by_id" ON "alerts" ("created_by_id")',
    );
    await q.query(
      'CREATE INDEX "IDX_alerts_resolved_by_id" ON "alerts" ("resolved_by_id")',
    );
    await q.query('CREATE INDEX "IDX_alerts_status" ON "alerts" ("status")');
  }

  async down(q: QueryRunner) {
    await q.query('DROP INDEX "IDX_alerts_status"');
    await q.query('DROP INDEX "IDX_alerts_resolved_by_id"');
    await q.query('DROP INDEX "IDX_alerts_created_by_id"');
    await q.query('DROP INDEX "IDX_alerts_interaction_id"');
    await q.query('DROP INDEX "IDX_alerts_health_center_id"');
    await q.query('DROP INDEX "IDX_psychooncology_appointments_status"');
    await q.query(
      'DROP INDEX "IDX_psychooncology_appointments_availability_id"',
    );
    await q.query(
      'DROP INDEX "IDX_psychooncology_appointments_interaction_id"',
    );
    await q.query('DROP INDEX "IDX_psychooncology_appointments_volunteer_id"');
    await q.query('DROP INDEX "IDX_psychooncology_appointments_patient_id"');
    await q.query('DROP INDEX "IDX_volunteer_availability_status"');
    await q.query('DROP INDEX "IDX_volunteer_availability_volunteer_id"');
  }
}
