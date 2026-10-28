import { MigrationInterface, QueryRunner } from 'typeorm';

// A1: los acompañantes dejan de ser filas de `patients` (role COMPANION) y
// pasan a `companions`, conservando su UUID para que los vínculos sigan
// valiendo. El parentesco pasa a catálogo (companion_relationship).

const RELATIONSHIPS: [code: string, label: string][] = [
  ['MOTHER', 'Mamá'],
  ['FATHER', 'Papá'],
  ['SPOUSE', 'Cónyuge o pareja'],
  ['SON_DAUGHTER', 'Hijo(a)'],
  ['SIBLING', 'Hermano(a)'],
  ['GRANDPARENT', 'Abuelo(a)'],
  ['GRANDCHILD', 'Nieto(a)'],
  ['UNCLE_AUNT', 'Tío(a)'],
  ['NEPHEW_NIECE', 'Sobrino(a)'],
  ['COUSIN', 'Primo(a)'],
  ['IN_LAW', 'Familiar político (suegro(a), cuñado(a), yerno, nuera)'],
  ['LEGAL_GUARDIAN', 'Tutor legal'],
  ['FRIEND', 'Amigo(a)'],
  ['NEIGHBOR', 'Vecino(a)'],
];

/** Tablas que no deberían tener filas de un acompañante: si las hay, se detiene. */
const PATIENT_ONLY: [table: string, column: string][] = [
  ['follow_ups', 'subject_patient_id'],
  ['reminders', 'subject_patient_id'],
  ['companion_patient', 'patient_id'],
  ['psychooncology_appointments', 'patient_id'],
  ['patient_insurance', 'patient_id'],
  ['patient_diagnoses', 'patient_id'],
  ['patient_treatments', 'patient_id'],
  ['patient_medical_appointments', 'patient_id'],
  ['patient_sis_affiliation', 'patient_id'],
  ['enrollments', 'patient_id'],
  ['patient_symptom_reports', 'patient_id'],
  ['treatment_medications', 'patient_id'],
  ['patient_social_notes', 'patient_id'],
  ['patient_health_background_assessments', 'patient_id'],
  ['patient_diagnostic_status_events', 'patient_id'],
  ['patient_documents', 'patient_id'],
  ['patient_psychooncology_support_assessments', 'patient_id'],
  ['patient_non_oncological_follow_ups', 'patient_id'],
  ['follow_up_attempts', 'patient_id'],
  ['alert_reports', 'patient_id'],
  ['surveys', 'patient_id'],
  ['psychooncology_cycles', 'patient_id'],
  ['referrals', 'patient_id'],
  ['follow_up_reenrollments', 'patient_id'],
];

const dropForeignKey = (table: string, column: string) => `
  DO $$
  DECLARE name text;
  BEGIN
    FOR name IN
      SELECT c.conname FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
       WHERE c.contype = 'f' AND c.conrelid = '${table}'::regclass AND a.attname = '${column}'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${table}', name);
    END LOOP;
  END $$`;

export class CompanionsAsEntity1784930000000 implements MigrationInterface {
  name = 'CompanionsAsEntity1784930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Movimiento estructural: no se registra como cambio de cada paciente.
    await queryRunner.query(
      `SELECT set_config('app.audit', '{"suppress":"on"}', true)`,
    );

    for (const [table, column] of PATIENT_ONLY) {
      const [{ n }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS n FROM "${table}" t
           JOIN patients p ON p.id = t."${column}" WHERE p.role = 'COMPANION'`,
      )) as { n: number }[];
      if (n > 0)
        throw new Error(
          `Hay ${n} filas en ${table}.${column} que apuntan a acompañantes; revísalas antes de migrar.`,
        );
    }
    const [{ n: strangers }] = (await queryRunner.query(`
      SELECT COUNT(*)::int AS n FROM follow_ups f
        JOIN patients p ON p.id = f.interlocutor_id
       WHERE f.interlocutor_id <> f.subject_patient_id AND p.role <> 'COMPANION'
    `)) as { n: number }[];
    if (strangers > 0)
      throw new Error(
        `Hay ${strangers} seguimientos cuyo interlocutor es otro paciente; revísalos antes de migrar.`,
      );

    await queryRunner.query(`
      CREATE TABLE "companions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "full_name" varchar(255) NOT NULL,
        "document_type" varchar(10),
        "dni" varchar(20),
        "birth_date" date,
        "gender" varchar(10),
        "primary_phone" varchar(50),
        "secondary_phone" varchar(50),
        "has_whatsapp" boolean NOT NULL DEFAULT false,
        "email" varchar(255),
        "converted_patient_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_companions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_companions_document_type"
          CHECK ("document_type" IS NULL OR "document_type" IN ('DNI', 'CE', 'CPP')),
        CONSTRAINT "FK_companions_converted_patient" FOREIGN KEY ("converted_patient_id")
          REFERENCES "patients"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_companions_dni" ON "companions" ("dni") WHERE "dni" IS NOT NULL`,
    );
    await queryRunner.query(`
      INSERT INTO companions (id, full_name, document_type, dni, birth_date, gender,
        primary_phone, secondary_phone, has_whatsapp, email, created_at, updated_at)
      SELECT id, full_name, document_type, dni, birth_date, gender,
        primary_phone, secondary_phone, has_whatsapp, email, created_at, updated_at
        FROM patients WHERE role = 'COMPANION'
    `);

    // Seguimientos: interlocutor_id (paciente o acompañante) → interlocutor_companion_id.
    await queryRunner.query(
      `ALTER TABLE follow_ups ADD COLUMN "interlocutor_companion_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE follow_ups SET interlocutor_companion_id = interlocutor_id
       WHERE interlocutor_id IN (SELECT id FROM companions)
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_follow_ups_interlocutor_id"`,
    );
    await queryRunner.query(dropForeignKey('follow_ups', 'interlocutor_id'));
    await queryRunner.query(
      `ALTER TABLE follow_ups DROP COLUMN "interlocutor_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE follow_ups ADD CONSTRAINT "FK_follow_ups_interlocutor_companion"
        FOREIGN KEY ("interlocutor_companion_id") REFERENCES "companions"("id")
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_follow_ups_interlocutor_companion_id" ON follow_ups ("interlocutor_companion_id")`,
    );

    for (const table of [
      'companion_patient',
      'enrollments',
      'psychooncology_appointments',
    ]) {
      await queryRunner.query(dropForeignKey(table, 'companion_id'));
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_companion"
          FOREIGN KEY ("companion_id") REFERENCES "companions"("id")
      `);
    }

    // Parentesco a catálogo: los códigos conocidos se conservan; cada texto
    // libre distinto se agrega al catálogo tal cual (C1: si falta, se agrega).
    for (const [index, [code, label]] of RELATIONSHIPS.entries())
      await queryRunner.query(
        `INSERT INTO catalog_items (kind, code, label, sort_order, is_active, is_system)
         VALUES ('companion_relationship', $1, $2, $3, true, false)
         ON CONFLICT (kind, code) DO NOTHING`,
        [code, label, index + 1],
      );
    await queryRunner.query(
      `ALTER TABLE companion_patient ALTER COLUMN "relationship" TYPE varchar(100)`,
    );
    await queryRunner.query(`
      UPDATE companion_patient SET relationship = NULL
       WHERE relationship IS NOT NULL AND (BTRIM(relationship) = '' OR relationship = 'OTHER')
    `);
    await queryRunner.query(`
      WITH free AS (
        SELECT DISTINCT BTRIM(relationship) AS label
          FROM companion_patient
         WHERE relationship IS NOT NULL
           AND relationship NOT IN (SELECT code FROM catalog_items WHERE kind = 'companion_relationship')
      )
      INSERT INTO catalog_items (kind, code, label, sort_order, is_active, is_system)
      SELECT 'companion_relationship',
             LEFT(UPPER(REGEXP_REPLACE(UNACCENT_FREE, '[^A-Za-z0-9]+', '_', 'g')), 90) || '_' || LEFT(md5(label), 6),
             label, 100, true, false
        FROM (SELECT label, TRANSLATE(label, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU') AS UNACCENT_FREE FROM free) f
      ON CONFLICT (kind, code) DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE companion_patient link SET relationship = item.code
        FROM catalog_items item
       WHERE item.kind = 'companion_relationship'
         AND link.relationship IS NOT NULL
         AND link.relationship <> item.code
         AND BTRIM(link.relationship) = item.label
    `);

    await queryRunner.query(`DELETE FROM patients WHERE role = 'COMPANION'`);
    await queryRunner.query(
      `ALTER TABLE patients DROP CONSTRAINT IF EXISTS "CHK_patients_role"`,
    );
    await queryRunner.query(`
      DO $$
      DECLARE name text;
      BEGIN
        FOR name IN SELECT conname FROM pg_constraint
          WHERE conrelid = 'patients'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%COMPANION%'
        LOOP
          EXECUTE format('ALTER TABLE patients DROP CONSTRAINT %I', name);
        END LOOP;
      END $$`);
    await queryRunner.query(
      `ALTER TABLE patients ADD CONSTRAINT "CHK_patients_role" CHECK ("role" IN ('UNKNOWN', 'PATIENT'))`,
    );

    // Historial (S2) de los datos del acompañante; no pertenecen a un paciente.
    await queryRunner.query(`
      CREATE TRIGGER "audit_companions" AFTER INSERT OR UPDATE OR DELETE ON "companions"
       FOR EACH ROW EXECUTE FUNCTION audit_row_change('converted_patient_id')
    `);
    await queryRunner.query(`SELECT set_config('app.audit', '', true)`);
  }

  public down(): Promise<void> {
    // Volver a mezclar acompañantes y pacientes no es seguro una vez que se
    // crean acompañantes nuevos; se restaura desde respaldo.
    throw new Error(
      'CompanionsAsEntity no tiene vuelta atrás; restaura un respaldo.',
    );
  }
}
