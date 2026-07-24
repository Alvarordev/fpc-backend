import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClinicalHistory1784859000000 implements MigrationInterface {
  name = 'AddClinicalHistory1784859000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "patient_insurance" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "interaction_id" uuid NOT NULL REFERENCES "interactions"("id"), "insurance_type" varchar(30) NOT NULL CHECK ("insurance_type" IN ('SIS','ESSALUD','EPS','FUERZAS_ARMADAS','SALUDPOL','NONE')), "eps_provider" varchar(30) CHECK ("eps_provider" IS NULL OR "eps_provider" IN ('RIMAC','PACIFICO','MAPFRE','SANITAS','LA_POSITIVA','ONCOSALUD','OTHER')), "is_current" boolean NOT NULL, "change_reason" text, "start_date" date, "end_date" date, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "patient_diagnoses" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "interaction_id" uuid NOT NULL REFERENCES "interactions"("id"), "diagnosis" text NOT NULL, "cancer_stage" varchar(20) CHECK ("cancer_stage" IS NULL OR "cancer_stage" IN ('STAGE_1','STAGE_2','STAGE_3','STAGE_4','UNKNOWN')), "diagnosis_date" date, "health_center_id" uuid REFERENCES "health_centers"("id"), "diagnosis_specialty" varchar(255), "symptom_leading_to_checkup" text, "wait_time_for_diagnosis" varchar(100), "has_medical_report" boolean NOT NULL DEFAULT false, "is_current" boolean NOT NULL, "change_reason" text, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "patient_treatments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "interaction_id" uuid NOT NULL REFERENCES "interactions"("id"), "diagnosis_id" uuid NOT NULL REFERENCES "patient_diagnoses"("id"), "treatment_type" varchar(255) NOT NULL, "treatment_frequency" varchar(100), "health_center_id" uuid REFERENCES "health_centers"("id"), "start_date" date, "end_date" date, "is_current" boolean NOT NULL, "change_reason" text, "not_receiving_reason" text, "treatment_situation" varchar(50), "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "patient_medical_appointments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "interaction_id" uuid NOT NULL REFERENCES "interactions"("id"), "health_center_id" uuid REFERENCES "health_centers"("id"), "specialty" varchar(255) NOT NULL, "appointment_date" date, "next_appointment_date" date, "has_referral_sheet" boolean NOT NULL DEFAULT false, "referred_to" varchar(255), "difficulties" text, "is_first_consultation" boolean NOT NULL DEFAULT false, "is_current" boolean NOT NULL, "change_reason" text, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE "patient_sis_affiliation" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "interaction_id" uuid NOT NULL REFERENCES "interactions"("id"), "can_affiliate" boolean NOT NULL, "expected_date" date, "cant_affiliate_reason" text, "affiliated_at" timestamptz, "comments" text, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    for (const [table, column] of [
      ['patient_insurance', 'patient_id'],
      ['patient_insurance', 'interaction_id'],
      ['patient_diagnoses', 'patient_id'],
      ['patient_diagnoses', 'interaction_id'],
      ['patient_diagnoses', 'health_center_id'],
      ['patient_treatments', 'patient_id'],
      ['patient_treatments', 'interaction_id'],
      ['patient_treatments', 'diagnosis_id'],
      ['patient_treatments', 'health_center_id'],
      ['patient_medical_appointments', 'patient_id'],
      ['patient_medical_appointments', 'interaction_id'],
      ['patient_medical_appointments', 'health_center_id'],
      ['patient_sis_affiliation', 'patient_id'],
      ['patient_sis_affiliation', 'interaction_id'],
    ] as const)
      await q.query(
        `CREATE INDEX "IDX_${table}_${column}" ON "${table}" ("${column}")`,
      );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_patient_insurance_current" ON "patient_insurance" ("patient_id") WHERE "is_current" = true`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_patient_diagnoses_current" ON "patient_diagnoses" ("patient_id") WHERE "is_current" = true`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_patient_treatments_current" ON "patient_treatments" ("diagnosis_id") WHERE "is_current" = true`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_patient_medical_appointments_current" ON "patient_medical_appointments" ("patient_id", "specialty") WHERE "is_current" = true`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "patient_sis_affiliation"');
    await q.query('DROP TABLE "patient_medical_appointments"');
    await q.query('DROP TABLE "patient_treatments"');
    await q.query('DROP TABLE "patient_diagnoses"');
    await q.query('DROP TABLE "patient_insurance"');
  }
}
