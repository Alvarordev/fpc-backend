import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandPatientDocumentTypes1784902000000 implements MigrationInterface {
  name = 'ExpandPatientDocumentTypes1784902000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_documents" DROP CONSTRAINT "CHK_patient_documents_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" ADD CONSTRAINT "CHK_patient_documents_type" CHECK ("document_type" IN ('MEDICAL_REPORT', 'CLINICAL_HISTORY', 'PRESCRIPTION', 'APPOINTMENT_SCHEDULE', 'MEDICAL_ORDER', 'EXAM_RESULTS', 'REFERRAL_OR_COUNTERREFERRAL', 'IDENTITY_DOCUMENT', 'CONADIS_DISABILITY_DOCUMENT', 'OTHER'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" DROP CONSTRAINT "CHK_patient_documents_association"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" ADD CONSTRAINT "CHK_patient_documents_association" CHECK (("document_type" = 'MEDICAL_REPORT' AND "diagnosis_id" IS NOT NULL AND "treatment_id" IS NULL) OR ("document_type" = 'PRESCRIPTION' AND "diagnosis_id" IS NULL AND "treatment_id" IS NOT NULL) OR ("document_type" IN ('CLINICAL_HISTORY', 'APPOINTMENT_SCHEDULE', 'MEDICAL_ORDER', 'EXAM_RESULTS', 'REFERRAL_OR_COUNTERREFERRAL', 'IDENTITY_DOCUMENT', 'CONADIS_DISABILITY_DOCUMENT') AND "diagnosis_id" IS NULL AND "treatment_id" IS NULL) OR ("document_type" = 'OTHER' AND "diagnosis_id" IS NULL AND "treatment_id" IS NULL AND "description" IS NOT NULL AND length(btrim("description")) > 0))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_documents" DROP CONSTRAINT "CHK_patient_documents_association"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" ADD CONSTRAINT "CHK_patient_documents_association" CHECK (("document_type" = 'MEDICAL_REPORT' AND "diagnosis_id" IS NOT NULL AND "treatment_id" IS NULL) OR ("document_type" = 'PRESCRIPTION' AND "diagnosis_id" IS NULL AND "treatment_id" IS NOT NULL) OR ("document_type" = 'OTHER' AND "diagnosis_id" IS NULL AND "treatment_id" IS NULL AND "description" IS NOT NULL AND length(btrim("description")) > 0))`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" DROP CONSTRAINT "CHK_patient_documents_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" ADD CONSTRAINT "CHK_patient_documents_type" CHECK ("document_type" IN ('MEDICAL_REPORT', 'PRESCRIPTION', 'OTHER'))`,
    );
  }
}
