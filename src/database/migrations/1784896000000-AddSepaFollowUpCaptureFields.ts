import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSepaFollowUpCaptureFields1784896000000 implements MigrationInterface {
  name = 'AddSepaFollowUpCaptureFields1784896000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" ADD COLUMN "attended_via_sepa" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" ADD COLUMN "referred_via_sepa" boolean`,
    );

    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "treatment_via_sepa" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "interruption_reason" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD CONSTRAINT "CHK_patient_treatments_interruption_reason" CHECK ("interruption_reason" IS NULL OR "interruption_reason" IN ('ADVERSE_REACTION','THERAPEUTIC_OPTION_EVAL','OTHER'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "interruption_reason_other" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "scheduled_sessions" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "completed_sessions" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "hormonal_treatment_completed" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "access_barrier_code" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD CONSTRAINT "CHK_patient_treatments_access_barrier_code" CHECK ("access_barrier_code" IS NULL OR "access_barrier_code" IN ('TRANSFER','LODGING','ALTERNATIVE_MEDICINE','EXCESSIVE_COST','DOES_NOT_WANT_TO_START','STOCKOUT','INFUSION_ROOM_INOPERATIVE','PATIENT_OVERLOAD','OTHER'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "access_barrier_other" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "oriented_regarding_barriers" boolean`,
    );

    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "transportation_via_sepa" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "transportation_sepa_provider" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_transportation_sepa_provider" CHECK ("transportation_sepa_provider" IS NULL OR "transportation_sepa_provider" IN ('CRUZ_DEL_SUR','LATAM_AVION_SOLIDARIO','OTHER'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "transportation_sepa_provider_other" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "shelter_via_sepa" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "shelter_sepa_provider" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_shelter_sepa_provider" CHECK ("shelter_sepa_provider" IS NULL OR "shelter_sepa_provider" IN ('FRIEDA_HELLER','CASA_MAGIA','CASA_RONALD_MCDONALD','INSPIRA','ALINEN','OTHER'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "shelter_sepa_provider_other" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "attended_educational_talk" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "attended_educational_talk_at" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD COLUMN "program_dropout_reason_code" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "CHK_patient_details_program_dropout_reason_code" CHECK ("program_dropout_reason_code" IS NULL OR "program_dropout_reason_code" IN ('VOLUNTARY','UNLOCATABLE','DECEASED','OTHER'))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP CONSTRAINT "CHK_patient_details_program_dropout_reason_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "program_dropout_reason_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "attended_educational_talk_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "attended_educational_talk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "shelter_sepa_provider_other"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP CONSTRAINT "CHK_patient_details_shelter_sepa_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "shelter_sepa_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "shelter_via_sepa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "transportation_sepa_provider_other"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP CONSTRAINT "CHK_patient_details_transportation_sepa_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "transportation_sepa_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP COLUMN "transportation_via_sepa"`,
    );

    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "oriented_regarding_barriers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "access_barrier_other"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP CONSTRAINT "CHK_patient_treatments_access_barrier_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "access_barrier_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "hormonal_treatment_completed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "completed_sessions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "scheduled_sessions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "interruption_reason_other"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP CONSTRAINT "CHK_patient_treatments_interruption_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "interruption_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "treatment_via_sepa"`,
    );

    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP COLUMN "referred_via_sepa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_medical_appointments" DROP COLUMN "attended_via_sepa"`,
    );
  }
}
