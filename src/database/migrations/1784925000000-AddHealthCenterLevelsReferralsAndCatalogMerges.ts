import { MigrationInterface, QueryRunner } from 'typeorm';

// H1 (MINSA category/level, institution, ubigeo, RENIPRESS), H2/H3 (referrals,
// backfilled from the scattered has_referral fields) and C3 (catalog merges).
export class AddHealthCenterLevelsReferralsAndCatalogMerges1784925000000 implements MigrationInterface {
  name = 'AddHealthCenterLevelsReferralsAndCatalogMerges1784925000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "health_centers"
        ADD COLUMN "care_category" varchar(5),
        ADD COLUMN "institution" varchar(30),
        ADD COLUMN "ubigeo_district_code" varchar(6),
        ADD COLUMN "renipress_code" varchar(20)
    `);
    // Free-text category → MINSA enum when recognisable ("III-1", "iii 1", "Nivel II-E").
    await queryRunner.query(`
      UPDATE "health_centers" SET "care_category" = normalized.category
        FROM (
          SELECT id,
                 m[1] || '-' || m[2] AS category
            FROM "health_centers",
                 regexp_match(upper("category"), '(?:^|[^A-Z])(III|II|I)\\s*[-–]?\\s*([1-4E])(?:$|[^A-Z0-9])') AS m
           WHERE "category" IS NOT NULL
        ) normalized
       WHERE normalized.id = "health_centers".id
         AND normalized.category IN ('I-1','I-2','I-3','I-4','II-1','II-2','II-E','III-1','III-2','III-E')
    `);
    await queryRunner.query(
      `ALTER TABLE "health_centers" DROP COLUMN "category"`,
    );
    await queryRunner.query(`
      ALTER TABLE "health_centers"
        ADD COLUMN "care_level" varchar(3)
          GENERATED ALWAYS AS (split_part("care_category", '-', 1)) STORED,
        ADD CONSTRAINT "CHK_health_centers_care_category" CHECK ("care_category" IN ('I-1','I-2','I-3','I-4','II-1','II-2','II-E','III-1','III-2','III-E')),
        ADD CONSTRAINT "CHK_health_centers_institution" CHECK ("institution" IN ('MINSA','ESSALUD','FFAA_PNP','PRIVADO','GOBIERNO_REGIONAL','OTRO')),
        ADD CONSTRAINT "FK_health_centers_ubigeo_district_code" FOREIGN KEY ("ubigeo_district_code") REFERENCES "ubigeo_districts"("inei_code")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_health_centers_renipress_code"
        ON "health_centers" ("renipress_code") WHERE "renipress_code" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_health_centers_care_level" ON "health_centers" ("care_level")
    `);

    await queryRunner.query(`
      CREATE TABLE "catalog_merges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "kind" varchar(50) NOT NULL,
        "source_item_id" uuid NOT NULL REFERENCES "catalog_items"("id"),
        "target_item_id" uuid NOT NULL REFERENCES "catalog_items"("id"),
        "source_code" varchar(100) NOT NULL,
        "target_code" varchar(100) NOT NULL,
        "actor_user_id" uuid REFERENCES "users"("id"),
        "affected_rows" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_catalog_merges_source_item_id" ON "catalog_merges" ("source_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_catalog_merges_target_item_id" ON "catalog_merges" ("target_item_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "referrals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
        "origin_health_center_id" uuid REFERENCES "health_centers"("id"),
        "destination_health_center_id" uuid REFERENCES "health_centers"("id"),
        "specialty" varchar(100),
        "type" varchar(10) NOT NULL CHECK ("type" IN ('FORMAL', 'SELF')),
        "status" varchar(10) NOT NULL CHECK ("status" IN ('REQUESTED', 'ISSUED', 'ATTENDED', 'REJECTED', 'EXPIRED')),
        "requested_on" date NOT NULL,
        "issued_on" date,
        "attended_on" date,
        "via_sepa" boolean NOT NULL DEFAULT false,
        "follow_up_id" uuid REFERENCES "follow_ups"("id") ON DELETE SET NULL,
        "referral_sheet_document_id" uuid REFERENCES "patient_documents"("id") ON DELETE SET NULL,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_referrals_patient_id_requested_on" ON "referrals" ("patient_id", "requested_on")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_referrals_destination_health_center_id" ON "referrals" ("destination_health_center_id")`,
    );
    await queryRunner.query(`
      CREATE TRIGGER "audit_referrals" AFTER INSERT OR UPDATE OR DELETE ON "referrals"
        FOR EACH ROW EXECUTE FUNCTION audit_row_change('patient_id')
    `);

    // One referral per (patient, origin, destination); versions of the same
    // diagnosis/appointment/treatment and the same referral seen from several
    // records collapse into one row. Without destination, free text keeps them apart.
    await queryRunner.query(`
      WITH candidates AS (
        SELECT d.patient_id, d.health_center_id AS origin_id,
               d.referred_health_center_id AS destination_id,
               d.diagnosis_specialty AS specialty, d.follow_up_id,
               COALESCE(d.diagnosis_date, d.created_at::date) AS requested_on,
               NULL::date AS attended_on,
               COALESCE(d.is_sepa_active_referral, false) AS via_sepa,
               'ISSUED' AS status, NULL::text AS notes, d.created_at
          FROM patient_diagnoses d
         WHERE d.has_referral IS TRUE OR d.referred_health_center_id IS NOT NULL
        UNION ALL
        SELECT s.patient_id, s.health_center_id, s.referred_health_center_id,
               s.specialty, s.follow_up_id,
               COALESCE(s.first_consultation_date, s.created_at::date),
               NULL::date, COALESCE(s.referred_via_sepa, false),
               'ISSUED', NULL, s.created_at
          FROM patient_symptom_reports s
         WHERE s.has_referral IS TRUE OR s.referred_health_center_id IS NOT NULL
        UNION ALL
        SELECT a.patient_id, a.health_center_id, a.referred_health_center_id,
               a.specialty, a.follow_up_id,
               COALESCE(a.appointment_date, a.created_at::date),
               NULL::date, COALESCE(a.referred_via_sepa, false),
               'ISSUED', NULLIF(trim(a.referred_to), ''), a.created_at
          FROM patient_medical_appointments a
         WHERE a.has_referral_sheet IS TRUE
            OR a.referred_health_center_id IS NOT NULL
            OR NULLIF(trim(a.referred_to), '') IS NOT NULL
        UNION ALL
        SELECT t.patient_id, t.source_health_center_id, t.receiving_health_center_id,
               NULL, t.follow_up_id,
               COALESCE(t.start_date, t.created_at::date),
               CASE WHEN t.receiving_health_center_id IS NOT NULL THEN t.start_date END,
               COALESCE(t.treatment_via_sepa, false),
               CASE WHEN t.receiving_health_center_id IS NOT NULL AND t.start_date IS NOT NULL
                    THEN 'ATTENDED' ELSE 'ISSUED' END,
               NULL, t.created_at
          FROM patient_treatments t
         WHERE t.is_referred IS TRUE
      ),
      cleaned AS (
        SELECT c.*,
               CASE WHEN c.origin_id = c.destination_id THEN NULL ELSE c.origin_id END AS origin,
               (SELECT ci.code FROM catalog_items ci
                 WHERE ci.kind = 'medical_specialty' AND ci.code = c.specialty
                   AND ci.code <> 'OTRO') AS specialty_code
          FROM candidates c
      ),
      grouped AS (
        SELECT patient_id, origin, destination_id,
               CASE WHEN destination_id IS NULL THEN lower(COALESCE(notes, '')) END AS free_text_key,
               min(requested_on) AS requested_on,
               max(attended_on) AS attended_on,
               bool_or(via_sepa) AS via_sepa,
               CASE WHEN bool_or(status = 'ATTENDED') THEN 'ATTENDED' ELSE 'ISSUED' END AS status,
               (array_agg(follow_up_id ORDER BY requested_on, created_at))[1] AS follow_up_id,
               (array_agg(specialty_code ORDER BY requested_on, created_at)
                  FILTER (WHERE specialty_code IS NOT NULL))[1] AS specialty,
               string_agg(DISTINCT notes, ' / ') AS notes,
               min(created_at) AS created_at
          FROM cleaned
         GROUP BY patient_id, origin, destination_id,
                  CASE WHEN destination_id IS NULL THEN lower(COALESCE(notes, '')) END
      )
      INSERT INTO referrals (
        patient_id, origin_health_center_id, destination_health_center_id,
        specialty, type, status, requested_on, issued_on, attended_on,
        via_sepa, follow_up_id, notes, created_at, updated_at
      )
      SELECT patient_id, origin, destination_id, specialty, 'FORMAL',
             CASE WHEN status = 'ATTENDED' AND attended_on IS NOT NULL THEN 'ATTENDED' ELSE 'ISSUED' END,
             requested_on, requested_on,
             CASE WHEN status = 'ATTENDED' THEN GREATEST(attended_on, requested_on) END,
             via_sepa, follow_up_id, notes, created_at, created_at
        FROM grouped
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "referrals"`);
    await queryRunner.query(`DROP TABLE "catalog_merges"`);
    await queryRunner.query(`
      ALTER TABLE "health_centers" ADD COLUMN "category" varchar(50)
    `);
    await queryRunner.query(
      `UPDATE "health_centers" SET "category" = "care_category"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_health_centers_care_level"`);
    await queryRunner.query(`DROP INDEX "UQ_health_centers_renipress_code"`);
    await queryRunner.query(`
      ALTER TABLE "health_centers"
        DROP COLUMN "care_level",
        DROP COLUMN "care_category",
        DROP COLUMN "institution",
        DROP COLUMN "ubigeo_district_code",
        DROP COLUMN "renipress_code"
    `);
  }
}
