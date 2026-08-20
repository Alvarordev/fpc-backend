import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClinicalTabFields1784883000000 implements MigrationInterface {
  name = 'AddClinicalTabFields1784883000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "patient_diagnoses" ADD COLUMN "is_sepa_active_referral" boolean`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "operation_name" varchar(255)`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "care_program" varchar(10)`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "receives_teleconsultation" boolean`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "teleconsultation_note" text`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "teleconsultation_specialties" text[]`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "treatment_abandonment_reason" text`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP CONSTRAINT "patient_treatments_treatment_situation_check"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD CONSTRAINT "CHK_patient_treatments_treatment_situation" CHECK ("treatment_situation" IS NULL OR "treatment_situation" IN ('EN_CURSO','PENDIENTE_DE_INICIO','INTERRUMPIDO','FINALIZADO','SEARCHING','ABANDONED','DECEASED_DURING_TREATMENT','NOT_APPLICABLE','REMISSION'))`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD CONSTRAINT "CHK_patient_treatments_care_program" CHECK ("care_program" IS NULL OR "care_program" IN ('COPHOES','PADOMI'))`,
    );
    await q.query(
      `ALTER TABLE "patient_sis_affiliation" ADD COLUMN "affiliated_via_sepa" boolean`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "patient_sis_affiliation" DROP COLUMN "affiliated_via_sepa"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP CONSTRAINT "CHK_patient_treatments_care_program"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP CONSTRAINT "CHK_patient_treatments_treatment_situation"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD CONSTRAINT "patient_treatments_treatment_situation_check" CHECK ("treatment_situation" IS NULL OR "treatment_situation" IN ('EN_CURSO','PENDIENTE_DE_INICIO','INTERRUMPIDO','FINALIZADO'))`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "treatment_abandonment_reason"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "teleconsultation_specialties"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "teleconsultation_note"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "receives_teleconsultation"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "care_program"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "operation_name"`,
    );
    await q.query(
      `ALTER TABLE "patient_diagnoses" DROP COLUMN "is_sepa_active_referral"`,
    );
  }
}
