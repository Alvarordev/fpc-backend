import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientSocialNotes1784877000000 implements MigrationInterface {
  name = 'AddPatientSocialNotes1784877000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "patient_social_notes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL, "follow_up_id" uuid NOT NULL, "type" character varying(20) NOT NULL, "note" text NOT NULL, "author_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_patient_social_notes_type" CHECK ("type" IN ('SOCIAL_WORKER','CONADIS','FISSAL')), CONSTRAINT "PK_patient_social_notes_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_social_notes_patient_created_at_id" ON "patient_social_notes" ("patient_id", "created_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_social_notes_follow_up_id" ON "patient_social_notes" ("follow_up_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_social_notes_author_id" ON "patient_social_notes" ("author_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_social_notes" ADD CONSTRAINT "FK_patient_social_notes_patient_id" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_social_notes" ADD CONSTRAINT "FK_patient_social_notes_follow_up_id" FOREIGN KEY ("follow_up_id") REFERENCES "follow_ups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_social_notes" ADD CONSTRAINT "FK_patient_social_notes_author_id" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_social_notes" DROP CONSTRAINT "FK_patient_social_notes_author_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_social_notes" DROP CONSTRAINT "FK_patient_social_notes_follow_up_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_social_notes" DROP CONSTRAINT "FK_patient_social_notes_patient_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_patient_social_notes_author_id"`);
    await queryRunner.query(
      `DROP INDEX "IDX_patient_social_notes_follow_up_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_patient_social_notes_patient_created_at_id"`,
    );
    await queryRunner.query(`DROP TABLE "patient_social_notes"`);
  }
}
