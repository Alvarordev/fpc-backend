import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceAssignmentsAndSchedulingIntegrity1784863000000 implements MigrationInterface {
  name = 'EnforceAssignmentsAndSchedulingIntegrity1784863000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE "interactions" ALTER COLUMN "agent_id" SET NOT NULL',
    );
    await q.query(
      'ALTER TABLE "reminders" ALTER COLUMN "assigned_agent_id" SET NOT NULL',
    );
    await q.query(
      'ALTER TABLE "enrollments" ADD CONSTRAINT "UQ_enrollments_patient_id" UNIQUE ("patient_id")',
    );
    await q.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await q.query(
      `ALTER TABLE "volunteer_availability"
       ADD CONSTRAINT "EX_volunteer_availability_no_overlap"
       EXCLUDE USING gist (
         "volunteer_id" WITH =,
         "date" WITH =,
         tsrange("date" + "start_time", "date" + "end_time", '[)') WITH &&
       )`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE "volunteer_availability" DROP CONSTRAINT "EX_volunteer_availability_no_overlap"',
    );
    await q.query(
      'ALTER TABLE "enrollments" DROP CONSTRAINT "UQ_enrollments_patient_id"',
    );
    await q.query(
      'ALTER TABLE "reminders" ALTER COLUMN "assigned_agent_id" DROP NOT NULL',
    );
    await q.query(
      'ALTER TABLE "interactions" ALTER COLUMN "agent_id" DROP NOT NULL',
    );
  }
}
