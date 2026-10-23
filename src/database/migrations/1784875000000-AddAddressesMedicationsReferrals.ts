import { MigrationInterface, QueryRunner } from 'typeorm';
import { PERU_DEPARTMENTS } from '../entities/health-center.entity';

const DEPARTMENTS_CHECK = PERU_DEPARTMENTS.map(
  (department) => `'${department}'`,
).join(', ');

export class AddAddressesMedicationsReferrals1784875000000 implements MigrationInterface {
  name = 'AddAddressesMedicationsReferrals1784875000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "patient_addresses" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE, "follow_up_id" uuid REFERENCES "follow_ups"("id"), "type" varchar(20) NOT NULL CHECK ("type" IN ('PERMANENT','TEMPORARY')), "is_primary" boolean NOT NULL DEFAULT false, "address" text, "district" varchar(255), "province" varchar(255), "department" varchar(50) CHECK ("department" IS NULL OR "department" IN (${DEPARTMENTS_CHECK})), "reference" text, "dni_matches_address" boolean, "valid_from" date, "valid_to" date, "is_active" boolean NOT NULL DEFAULT true, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_patient_addresses_primary" ON "patient_addresses" ("patient_id") WHERE "is_primary" = true AND "is_active" = true`,
    );

    await q.query(
      `CREATE TABLE "treatment_medications" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "treatment_id" uuid NOT NULL REFERENCES "patient_treatments"("id") ON DELETE CASCADE, "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "name" varchar(255) NOT NULL, "dose_amount" numeric(10,2), "dose_unit" varchar(20) CHECK ("dose_unit" IS NULL OR "dose_unit" IN ('MG','G','ML','UI','TABLET','DROP','OTHER')), "dose_description" varchar(255), "route" varchar(20) CHECK ("route" IS NULL OR "route" IN ('ORAL','IV','IM','SUBCUTANEOUS','TOPICAL','OTHER')), "frequency_value_min" numeric(10,2), "frequency_value_max" numeric(10,2), "frequency_unit" varchar(10), "frequency_label" varchar(120), "frequency_canonical_minutes_min" integer, "frequency_canonical_minutes_max" integer, "start_date" date, "end_date" date, "is_active" boolean NOT NULL DEFAULT true, "notes" text, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );

    await q.query(
      `CREATE TABLE "patient_referrals" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "follow_up_id" uuid REFERENCES "follow_ups"("id"), "from_health_center_id" uuid REFERENCES "health_centers"("id"), "to_health_center_id" uuid NOT NULL REFERENCES "health_centers"("id"), "specialty" varchar(255), "reason" text, "referral_date" date, "is_active" boolean NOT NULL DEFAULT true, "has_referral_sheet" boolean NOT NULL DEFAULT false, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );

    for (const [table, column] of [
      ['patient_addresses', 'patient_id'],
      ['patient_addresses', 'follow_up_id'],
      ['patient_addresses', 'department'],
      ['treatment_medications', 'treatment_id'],
      ['treatment_medications', 'patient_id'],
      ['patient_referrals', 'patient_id'],
      ['patient_referrals', 'follow_up_id'],
      ['patient_referrals', 'from_health_center_id'],
      ['patient_referrals', 'to_health_center_id'],
    ] as const)
      await q.query(
        `CREATE INDEX "IDX_${table}_${column}" ON "${table}" ("${column}")`,
      );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "patient_referrals"');
    await q.query('DROP TABLE "treatment_medications"');
    await q.query('DROP TABLE "patient_addresses"');
  }
}
