import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientDocuments1784884000000 implements MigrationInterface {
  name = 'AddPatientDocuments1784884000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "patient_documents" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL, "document_type" character varying(32) NOT NULL, "diagnosis_id" uuid, "treatment_id" uuid, "description" text, "original_file_name" character varying(255) NOT NULL, "media_type" character varying(127) NOT NULL, "size_bytes" integer NOT NULL, "sha256" character varying(64) NOT NULL, "storage_key" character varying(512) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "uploaded_by_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "archived_at" TIMESTAMP WITH TIME ZONE, "archived_by_id" uuid, CONSTRAINT "CHK_patient_documents_type" CHECK ("document_type" IN ('MEDICAL_REPORT', 'PRESCRIPTION', 'OTHER')), CONSTRAINT "CHK_patient_documents_status" CHECK ("status" IN ('PENDING', 'ACTIVE', 'ARCHIVED')), CONSTRAINT "CHK_patient_documents_size" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760), CONSTRAINT "CHK_patient_documents_sha256" CHECK (length("sha256") = 64 AND "sha256" ~ '^[0-9a-fA-F]{64}$'), CONSTRAINT "CHK_patient_documents_association" CHECK ((("document_type" = 'MEDICAL_REPORT' AND "diagnosis_id" IS NOT NULL AND "treatment_id" IS NULL) OR ("document_type" = 'PRESCRIPTION' AND "diagnosis_id" IS NULL AND "treatment_id" IS NOT NULL) OR ("document_type" = 'OTHER' AND "diagnosis_id" IS NULL AND "treatment_id" IS NULL AND "description" IS NOT NULL AND length(btrim("description")) > 0))), CONSTRAINT "CHK_patient_documents_archive" CHECK ((("archived_at" IS NULL AND "archived_by_id" IS NULL) OR ("archived_at" IS NOT NULL AND "archived_by_id" IS NOT NULL))), CONSTRAINT "PK_patient_documents_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_patient_documents_storage_key" ON "patient_documents" ("storage_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_documents_patient_created_at_id" ON "patient_documents" ("patient_id", "created_at" DESC, "id" DESC) WHERE "status" <> 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_documents_diagnosis_id" ON "patient_documents" ("diagnosis_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_documents_treatment_id" ON "patient_documents" ("treatment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_documents_document_type" ON "patient_documents" ("document_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_documents_uploaded_by_id" ON "patient_documents" ("uploaded_by_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_documents_status_created_at" ON "patient_documents" ("status", "created_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" ADD CONSTRAINT "FK_patient_documents_patient_id" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" ADD CONSTRAINT "FK_patient_documents_diagnosis_id" FOREIGN KEY ("diagnosis_id") REFERENCES "patient_diagnoses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" ADD CONSTRAINT "FK_patient_documents_treatment_id" FOREIGN KEY ("treatment_id") REFERENCES "patient_treatments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" ADD CONSTRAINT "FK_patient_documents_uploaded_by_id" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" ADD CONSTRAINT "FK_patient_documents_archived_by_id" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_documents" DROP CONSTRAINT "FK_patient_documents_archived_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" DROP CONSTRAINT "FK_patient_documents_uploaded_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" DROP CONSTRAINT "FK_patient_documents_treatment_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" DROP CONSTRAINT "FK_patient_documents_diagnosis_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_documents" DROP CONSTRAINT "FK_patient_documents_patient_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_patient_documents_status_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_patient_documents_uploaded_by_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_patient_documents_document_type"`);
    await queryRunner.query(`DROP INDEX "IDX_patient_documents_treatment_id"`);
    await queryRunner.query(`DROP INDEX "IDX_patient_documents_diagnosis_id"`);
    await queryRunner.query(
      `DROP INDEX "IDX_patient_documents_patient_created_at_id"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_patient_documents_storage_key"`);
    await queryRunner.query(`DROP TABLE "patient_documents"`);
  }
}
