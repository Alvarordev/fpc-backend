import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientsAgentsVolunteers1784853883250 implements MigrationInterface {
  name = 'AddPatientsAgentsVolunteers1784853883250';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agents" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "full_name" character varying(255) NOT NULL, "phone" character varying(50) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_57ee94c84a8e570e362af59dce" UNIQUE ("user_id"), CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "patients" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "full_name" character varying(255) NOT NULL, "email" character varying(255), "dni" character varying(20), "birth_date" date, "gender" character varying(10), "primary_phone" character varying(50) NOT NULL, "secondary_phone" character varying(50), "has_whatsapp" boolean NOT NULL DEFAULT false, "role" character varying(20) NOT NULL DEFAULT 'UNKNOWN', "status" character varying(20) NOT NULL DEFAULT 'UNENROLLED', "is_active" boolean NOT NULL DEFAULT true, "deactivation_reason" character varying(30), "deactivation_reason_detail" text, "deactivated_at" TIMESTAMP WITH TIME ZONE, "deceased_at" date, "accompanies_patient_id" uuid, "is_primary_informant" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b09e471222674eb27a9ed8881b6" UNIQUE ("dni"), CONSTRAINT "CHK_f858527aed1001bc4d4ec75cec" CHECK ("role" != 'COMPANION' OR "accompanies_patient_id" IS NOT NULL), CONSTRAINT "CHK_c0c20ad183431754a9b188ce9f" CHECK ((("is_active" = true AND "deactivation_reason" IS NULL AND "deactivated_at" IS NULL AND "deactivation_reason_detail" IS NULL) OR ("is_active" = false AND "deactivation_reason" IS NOT NULL AND "deactivated_at" IS NOT NULL AND (("deactivation_reason" = 'OTHER' AND "deactivation_reason_detail" IS NOT NULL) OR ("deactivation_reason" != 'OTHER' AND "deactivation_reason_detail" IS NULL))))), CONSTRAINT "CHK_97188e1bbcb12f0d47b4f9acd9" CHECK ("deactivation_reason" IN ('DECEASED', 'WITHDREW_CONSENT', 'LOST_CONTACT', 'TRANSFERRED_OUT', 'OTHER')), CONSTRAINT "CHK_b579d1cc0ee80c6ef90367c229" CHECK ("status" IN ('UNENROLLED', 'ENROLLED')), CONSTRAINT "CHK_1908a26eec3ba7dc117ed80c7b" CHECK ("role" IN ('UNKNOWN', 'PATIENT', 'COMPANION')), CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patients_accompanies_patient_id" ON "patients"  ("accompanies_patient_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patients_status" ON "patients"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patients_role" ON "patients"  ("role") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patients_dni" ON "patients"  ("dni") `,
    );
    await queryRunner.query(
      `CREATE TABLE "patient_details" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL, "birth_department" character varying(255), "current_address" text, "current_district" character varying(255), "current_department" character varying(255), "dni_matches_address" boolean, "travel_time_to_hospital" character varying(100), "emergency_contact_name" character varying(255), "emergency_contact_phone" character varying(50), "zone_type" character varying(10), "emergency_contact_gender" character varying(10), "education_level" character varying(30), "native_language" character varying(100), "requires_translation" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_0dcebcfda628a6907744949891" UNIQUE ("patient_id"), CONSTRAINT "CHK_c2d1aa6893954799568d0db84a" CHECK ("education_level" IN ('INITIAL', 'PRIMARY_INCOMPLETE', 'PRIMARY', 'SECONDARY_INCOMPLETE', 'SECONDARY', 'TECHNICAL', 'TECHNICAL_INCOMPLETE', 'HIGHER', 'HIGHER_INCOMPLETE', 'NONE')), CONSTRAINT "PK_e586f52738a708dbd21e350f16d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "volunteers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "specialty" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "phone" character varying(50) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_b476166961c3d8f8f22198f88e" UNIQUE ("user_id"), CONSTRAINT "PK_f4e65e37cf47256e3f580ecee62" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" ADD CONSTRAINT "FK_57ee94c84a8e570e362af59dcea" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "FK_9bdc802f31ff59f1f16176c570e" FOREIGN KEY ("accompanies_patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" ADD CONSTRAINT "FK_0dcebcfda628a69077449498917" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "volunteers" ADD CONSTRAINT "FK_b476166961c3d8f8f22198f88e6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteers" DROP CONSTRAINT "FK_b476166961c3d8f8f22198f88e6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_details" DROP CONSTRAINT "FK_0dcebcfda628a69077449498917"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP CONSTRAINT "FK_9bdc802f31ff59f1f16176c570e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP CONSTRAINT "FK_57ee94c84a8e570e362af59dcea"`,
    );
    await queryRunner.query(`DROP TABLE "volunteers"`);
    await queryRunner.query(`DROP TABLE "patient_details"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_patients_dni"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_patients_role"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_patients_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_patients_accompanies_patient_id"`,
    );
    await queryRunner.query(`DROP TABLE "patients"`);
    await queryRunner.query(`DROP TABLE "agents"`);
  }
}
