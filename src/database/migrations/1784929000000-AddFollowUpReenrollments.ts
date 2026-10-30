import { MigrationInterface, QueryRunner } from 'typeorm';

const PURPOSES_BEFORE = [
  'FIRST_CONTACT',
  'ENROLLMENT',
  'FOLLOW_UP',
  'PSYCHOONCOLOGY_REFERRAL',
  'OTHER',
];
const PURPOSES = [...PURPOSES_BEFORE, 'REENROLLMENT'];

// Valores iniciales; fundación y admin pueden editar el catálogo.
const REASONS: [code: string, label: string][] = [
  ['NEW_SYMPTOMS', 'Presenta nuevos signos o síntomas'],
  ['NEW_DIAGNOSIS', 'Recibió un nuevo diagnóstico de cáncer'],
  ['RECURRENCE', 'Recaída o recurrencia'],
  ['RESUMES_TREATMENT', 'Retoma su tratamiento'],
  ['RECONTACT', 'Volvió a contactar al programa'],
  ['LOCATED_AGAIN', 'Se logró volver a ubicarlo'],
];

const purposeCheck = (values: string[]) =>
  `CHECK ("purpose" IN (${values.map((value) => `'${value}'`).join(',')}))`;

export class AddFollowUpReenrollments1784929000000 implements MigrationInterface {
  name = 'AddFollowUpReenrollments1784929000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "follow_ups"
        DROP CONSTRAINT "CHK_follow_ups_purpose",
        ADD CONSTRAINT "CHK_follow_ups_purpose" ${purposeCheck(PURPOSES)}
    `);
    await queryRunner.query(`
      CREATE TABLE "follow_up_reenrollments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "follow_up_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "reason" varchar(100) NOT NULL,
        "entry_source" varchar(100) NOT NULL,
        "entry_sub_source" varchar(100),
        "health_phase" varchar(50) NOT NULL,
        "health_subcategory" varchar(100),
        "contact_data_confirmed_at" timestamptz NOT NULL,
        "notes" text,
        "created_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follow_up_reenrollments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_follow_up_reenrollments_follow_up" FOREIGN KEY ("follow_up_id")
          REFERENCES "follow_ups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_follow_up_reenrollments_patient" FOREIGN KEY ("patient_id")
          REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_follow_up_reenrollments_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_follow_up_reenrollments_follow_up_id" ON "follow_up_reenrollments" ("follow_up_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_follow_up_reenrollments_patient_id" ON "follow_up_reenrollments" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "audit_follow_up_reenrollments" AFTER INSERT OR UPDATE OR DELETE ON "follow_up_reenrollments"
       FOR EACH ROW EXECUTE FUNCTION audit_row_change('patient_id')`,
    );
    for (const [index, [code, label]] of REASONS.entries())
      await queryRunner.query(
        `INSERT INTO catalog_items (kind, code, label, sort_order, is_active, is_system)
         VALUES ('reenrollment_reason', $1, $2, $3, true, false)
         ON CONFLICT (kind, code) DO NOTHING`,
        [code, label, index + 1],
      );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "follow_up_reenrollments"`);
    await queryRunner.query(
      `DELETE FROM catalog_items WHERE kind = 'reenrollment_reason'`,
    );
    await queryRunner.query(
      `UPDATE follow_ups SET purpose = 'OTHER' WHERE purpose = 'REENROLLMENT'`,
    );
    await queryRunner.query(`
      ALTER TABLE "follow_ups"
        DROP CONSTRAINT "CHK_follow_ups_purpose",
        ADD CONSTRAINT "CHK_follow_ups_purpose" ${purposeCheck(PURPOSES_BEFORE)}
    `);
  }
}
