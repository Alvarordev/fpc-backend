import { MigrationInterface, QueryRunner } from 'typeorm';

const CATALOG_ITEMS: Array<{
  kind: string;
  code: string;
  label: string;
  sortOrder: number;
}> = [
  {
    kind: 'location_share_status',
    code: 'SHARES',
    label: 'Sí, comparte la ubicación',
    sortOrder: 10,
  },
  {
    kind: 'location_share_status',
    code: 'DOES_NOT_WANT',
    label: 'No desea compartir',
    sortOrder: 20,
  },
  {
    kind: 'location_share_status',
    code: 'CANNOT_SHARE',
    label: 'No puede compartir (adulto mayor)',
    sortOrder: 30,
  },
  { kind: 'location_share_status', code: 'OTRO', label: 'Otro', sortOrder: 90 },
  {
    kind: 'temporary_housing_type',
    code: 'OWN',
    label: 'Propia',
    sortOrder: 10,
  },
  {
    kind: 'temporary_housing_type',
    code: 'RELATIVE',
    label: 'De un familiar',
    sortOrder: 20,
  },
  {
    kind: 'temporary_housing_type',
    code: 'INEN',
    label: 'Se queda en el INEN',
    sortOrder: 30,
  },
  {
    kind: 'temporary_housing_type',
    code: 'SHELTER',
    label: 'Albergue',
    sortOrder: 40,
  },
  {
    kind: 'temporary_housing_type',
    code: 'LODGING',
    label: 'Alojamiento / hotel',
    sortOrder: 50,
  },
  {
    kind: 'temporary_housing_type',
    code: 'OTRO',
    label: 'Otro',
    sortOrder: 90,
  },
];

// Identity document type (DNI/CE/CPP) and the follow-up questions about the
// web location and the provisional housing of a patient address.
export class AddIdentityDocumentAndHousingDetails1784916000000 implements MigrationInterface {
  name = 'AddIdentityDocumentAndHousingDetails1784916000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN "document_type" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "CHK_patients_document_type" CHECK ("document_type" IS NULL OR "document_type" IN ('DNI', 'CE', 'CPP'))`,
    );
    // Only numbers shaped like a DNI can be classified safely.
    await queryRunner.query(
      `UPDATE "patients" SET "document_type" = 'DNI' WHERE "dni" ~ '^[0-9]{8}$'`,
    );

    await queryRunner.query(`
      ALTER TABLE "patient_addresses"
        ADD COLUMN "location_share_status" character varying(100),
        ADD COLUMN "location_share_status_other" text,
        ADD COLUMN "housing_type" character varying(100),
        ADD COLUMN "housing_type_other" text,
        ADD COLUMN "shelter_name" character varying(255),
        ADD COLUMN "travel_time_to_hospital_value_min" numeric(10,2),
        ADD COLUMN "travel_time_to_hospital_value_max" numeric(10,2),
        ADD COLUMN "travel_time_to_hospital_unit" character varying(10),
        ADD COLUMN "travel_time_to_hospital_label" character varying(120),
        ADD COLUMN "travel_time_to_hospital_canonical_minutes_min" integer,
        ADD COLUMN "travel_time_to_hospital_canonical_minutes_max" integer,
        ADD COLUMN "average_lodging_cost" numeric(10,2),
        ADD COLUMN "average_lodging_cost_period" character varying(10)
    `);
    await queryRunner.query(
      `ALTER TABLE "patient_addresses" ADD CONSTRAINT "CHK_patient_addresses_lodging_cost_period" CHECK ("average_lodging_cost_period" IS NULL OR "average_lodging_cost_period" IN ('NIGHT', 'MONTH'))`,
    );

    for (const item of CATALOG_ITEMS) {
      await queryRunner.query(
        `INSERT INTO catalog_items (kind, code, label, sort_order, is_active, is_system)
         VALUES ($1, $2, $3, $4, true, true)
         ON CONFLICT (kind, code) DO UPDATE SET
           label = EXCLUDED.label,
           sort_order = EXCLUDED.sort_order,
           is_active = true,
           is_system = true,
           updated_at = now()`,
        [item.kind, item.code, item.label, item.sortOrder],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM catalog_items WHERE kind IN ('location_share_status', 'temporary_housing_type')`,
    );
    await queryRunner.query(`
      ALTER TABLE "patient_addresses"
        DROP CONSTRAINT "CHK_patient_addresses_lodging_cost_period",
        DROP COLUMN "average_lodging_cost_period",
        DROP COLUMN "average_lodging_cost",
        DROP COLUMN "travel_time_to_hospital_canonical_minutes_max",
        DROP COLUMN "travel_time_to_hospital_canonical_minutes_min",
        DROP COLUMN "travel_time_to_hospital_label",
        DROP COLUMN "travel_time_to_hospital_unit",
        DROP COLUMN "travel_time_to_hospital_value_max",
        DROP COLUMN "travel_time_to_hospital_value_min",
        DROP COLUMN "shelter_name",
        DROP COLUMN "housing_type_other",
        DROP COLUMN "housing_type",
        DROP COLUMN "location_share_status_other",
        DROP COLUMN "location_share_status"
    `);
    await queryRunner.query(
      `ALTER TABLE "patients" DROP CONSTRAINT "CHK_patients_document_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN "document_type"`,
    );
  }
}
