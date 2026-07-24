import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddAvailabilityAppointmentsAlerts1784858000000 implements MigrationInterface {
  name = 'AddAvailabilityAppointmentsAlerts1784858000000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE "volunteer_availability" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "volunteer_id" uuid NOT NULL REFERENCES "volunteers"("id"), "date" date NOT NULL, "start_time" time NOT NULL, "end_time" time NOT NULL, "status" varchar(20) NOT NULL DEFAULT 'AVAILABLE' CHECK ("status" IN ('AVAILABLE','RESERVED')), "created_at" timestamptz NOT NULL DEFAULT now(), UNIQUE ("volunteer_id","date","start_time"))`,
    );
    await q.query(
      `CREATE TABLE "psychooncology_appointments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "volunteer_id" uuid NOT NULL REFERENCES "volunteers"("id"), "interaction_id" uuid NOT NULL REFERENCES "interactions"("id"), "availability_id" uuid NOT NULL REFERENCES "volunteer_availability"("id"), "patient_email" varchar(255), "session_number" int NOT NULL CHECK ("session_number" > 0), "is_additional_session" boolean NOT NULL DEFAULT false, "modality" varchar(20) NOT NULL CHECK ("modality" IN ('CALL','VIDEO_CALL')), "status" varchar(20) NOT NULL DEFAULT 'SCHEDULED' CHECK ("status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_ANSWER')), "scheduled_at" timestamptz NOT NULL, "completed_at" timestamptz, "topic_addressed" text, "session_details" text, "additional_observations" text, "recommendations" text, "referral" varchar(30), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "alerts" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "health_center_id" uuid NOT NULL REFERENCES "health_centers"("id"), "interaction_id" uuid NOT NULL REFERENCES "interactions"("id"), "created_by_id" uuid NOT NULL REFERENCES "agents"("id"), "title" text NOT NULL, "description" text NOT NULL, "status" varchar(30) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE','RESOLVED')), "resolved_at" timestamptz, "resolved_by_id" uuid REFERENCES "agents"("id"), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE "alerts"');
    await q.query('DROP TABLE "psychooncology_appointments"');
    await q.query('DROP TABLE "volunteer_availability"');
  }
}
