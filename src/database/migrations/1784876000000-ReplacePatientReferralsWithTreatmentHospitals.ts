import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplacePatientReferralsWithTreatmentHospitals1784876000000
  implements MigrationInterface
{
  name = 'ReplacePatientReferralsWithTreatmentHospitals1784876000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "is_referred" boolean NOT NULL DEFAULT false`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "source_health_center_id" uuid REFERENCES "health_centers"("id")`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "receiving_health_center_id" uuid REFERENCES "health_centers"("id")`,
    );
    await q.query(
      `UPDATE "patient_treatments" SET "receiving_health_center_id" = "health_center_id"`,
    );

    // Only migrate a referral when it maps unambiguously to one current
    // treatment. Multiple referrals or concurrent treatment lines are not
    // represented in the new model and are intentionally discarded below.
    await q.query(`
      WITH current_treatments AS (
        SELECT patient_id, (array_agg(id ORDER BY id))[1] AS treatment_id
        FROM patient_treatments
        WHERE is_current = true
        GROUP BY patient_id
        HAVING COUNT(*) = 1
      ), active_referrals AS (
        SELECT patient_id,
               (array_agg(from_health_center_id ORDER BY id))[1] AS source_health_center_id,
               (array_agg(to_health_center_id ORDER BY id))[1] AS receiving_health_center_id
        FROM patient_referrals
        WHERE is_active = true
        GROUP BY patient_id
        HAVING COUNT(*) = 1
      )
      UPDATE patient_treatments treatment
      SET is_referred = true,
          source_health_center_id = referral.source_health_center_id,
          receiving_health_center_id = referral.receiving_health_center_id
      FROM current_treatments current_treatment
      JOIN active_referrals referral ON referral.patient_id = current_treatment.patient_id
      WHERE treatment.id = current_treatment.treatment_id
        AND referral.source_health_center_id IS NOT NULL
        AND referral.receiving_health_center_id IS NOT NULL
        AND referral.source_health_center_id <> referral.receiving_health_center_id
    `);

    await q.query(
      `ALTER TABLE "patient_treatments" ADD CONSTRAINT "CHK_patient_treatments_referral_centers" CHECK (("is_referred" = false AND "source_health_center_id" IS NULL) OR ("is_referred" = true AND "source_health_center_id" IS NOT NULL AND "receiving_health_center_id" IS NOT NULL AND "source_health_center_id" <> "receiving_health_center_id"))`,
    );
    await q.query(
      `DROP INDEX IF EXISTS "IDX_patient_treatments_health_center_id"`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_treatments_source_health_center_id" ON "patient_treatments" ("source_health_center_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_treatments_receiving_health_center_id" ON "patient_treatments" ("receiving_health_center_id")`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "health_center_id"`,
    );
    await q.query(`DROP TABLE "patient_referrals"`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "patient_referrals" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "patient_id" uuid NOT NULL REFERENCES "patients"("id"), "follow_up_id" uuid REFERENCES "follow_ups"("id"), "from_health_center_id" uuid REFERENCES "health_centers"("id"), "to_health_center_id" uuid NOT NULL REFERENCES "health_centers"("id"), "specialty" varchar(255), "reason" text, "referral_date" date, "is_active" boolean NOT NULL DEFAULT true, "has_referral_sheet" boolean NOT NULL DEFAULT false, "created_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" ADD COLUMN "health_center_id" uuid REFERENCES "health_centers"("id")`,
    );
    await q.query(
      `UPDATE "patient_treatments" SET "health_center_id" = "receiving_health_center_id"`,
    );
    await q.query(
      `DROP INDEX IF EXISTS "IDX_patient_treatments_source_health_center_id"`,
    );
    await q.query(
      `DROP INDEX IF EXISTS "IDX_patient_treatments_receiving_health_center_id"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP CONSTRAINT IF EXISTS "CHK_patient_treatments_referral_centers"`,
    );
    await q.query(
      `CREATE INDEX "IDX_patient_treatments_health_center_id" ON "patient_treatments" ("health_center_id")`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "source_health_center_id"`,
    );
    await q.query(
      `ALTER TABLE "patient_treatments" DROP COLUMN "receiving_health_center_id"`,
    );
    await q.query(`ALTER TABLE "patient_treatments" DROP COLUMN "is_referred"`);
  }
}
