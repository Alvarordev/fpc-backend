import { MigrationInterface, QueryRunner } from 'typeorm';

// CH1: el interés en charlas se registra sobre acompañantes y la charla es un
// catálogo. Reemplaza enrollment_family_talk_interests (nombre y teléfono en
// texto libre): cada familiar se empareja por nombre con un acompañante del
// paciente o se crea uno nuevo vinculado.
const normalized = (column: string) =>
  `LOWER(REGEXP_REPLACE(TRANSLATE(BTRIM(${column}), 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'), '\\s+', ' ', 'g'))`;

export class CompanionTalkInterests1784931000000 implements MigrationInterface {
  name = 'CompanionTalkInterests1784931000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "companion_talk_interests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "companion_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "talk" varchar(100) NOT NULL,
        "follow_up_id" uuid,
        "created_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_companion_talk_interests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_companion_talk_interests_companion" FOREIGN KEY ("companion_id")
          REFERENCES "companions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_companion_talk_interests_patient" FOREIGN KEY ("patient_id")
          REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_companion_talk_interests_follow_up" FOREIGN KEY ("follow_up_id")
          REFERENCES "follow_ups"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_companion_talk_interests_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_companion_talk_interests_companion_talk" ON "companion_talk_interests" ("companion_id", "talk")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_companion_talk_interests_patient_id" ON "companion_talk_interests" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_companion_talk_interests_talk" ON "companion_talk_interests" ("talk")`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "audit_companion_talk_interests" AFTER INSERT OR UPDATE OR DELETE ON "companion_talk_interests"
       FOR EACH ROW EXECUTE FUNCTION audit_row_change('patient_id')`,
    );

    await queryRunner.query(
      `SELECT set_config('app.audit', '{"suppress":"on"}', true)`,
    );
    // Catálogo de charlas con los nombres ya usados.
    await queryRunner.query(`
      INSERT INTO catalog_items (kind, code, label, sort_order, is_active, is_system)
      SELECT 'educational_talk',
             LEFT(UPPER(REGEXP_REPLACE(TRANSLATE(label, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'), '[^A-Za-z0-9]+', '_', 'g')), 90)
               || '_' || LEFT(md5(label), 6),
             label, 100, true, false
        FROM (SELECT DISTINCT BTRIM(talk_name) AS label FROM enrollment_family_talk_interests
               WHERE BTRIM(talk_name) <> '') t
      ON CONFLICT (kind, code) DO NOTHING
    `);

    // Familiares sin acompañante con ese nombre: se crean y vinculan.
    await queryRunner.query(`
      CREATE TEMP TABLE talk_people ON COMMIT DROP AS
      SELECT DISTINCT ON (e.patient_id, ${normalized('i.family_member_name')})
             e.patient_id, BTRIM(i.family_member_name) AS full_name,
             NULLIF(BTRIM(i.family_member_phone), '') AS phone,
             NULLIF(BTRIM(i.family_member_email), '') AS email,
             ${normalized('i.family_member_name')} AS key,
             (SELECT c.id FROM companion_patient cp JOIN companions c ON c.id = cp.companion_id
               WHERE cp.patient_id = e.patient_id
                 AND ${normalized('c.full_name')} = ${normalized('i.family_member_name')}
               LIMIT 1) AS companion_id
        FROM enrollment_family_talk_interests i
        JOIN enrollments e ON e.id = i.enrollment_id
       WHERE BTRIM(i.family_member_name) <> ''
       ORDER BY e.patient_id, ${normalized('i.family_member_name')}, i.created_at
    `);
    await queryRunner.query(
      `UPDATE talk_people SET companion_id = gen_random_uuid() WHERE companion_id IS NULL`,
    );
    await queryRunner.query(`
      INSERT INTO companions (id, full_name, primary_phone, email)
      SELECT companion_id, full_name, phone, email FROM talk_people
       WHERE companion_id NOT IN (SELECT id FROM companions)
    `);
    await queryRunner.query(`
      INSERT INTO companion_patient (companion_id, patient_id)
      SELECT companion_id, patient_id FROM talk_people
      ON CONFLICT (companion_id, patient_id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO companion_talk_interests (companion_id, patient_id, talk, follow_up_id, created_at)
      SELECT DISTINCT ON (p.companion_id, item.code)
             p.companion_id, e.patient_id, item.code, e.follow_up_id, i.created_at
        FROM enrollment_family_talk_interests i
        JOIN enrollments e ON e.id = i.enrollment_id
        JOIN talk_people p ON p.patient_id = e.patient_id AND p.key = ${normalized('i.family_member_name')}
        JOIN catalog_items item ON item.kind = 'educational_talk' AND item.label = BTRIM(i.talk_name)
       ORDER BY p.companion_id, item.code, i.created_at
    `);
    await queryRunner.query(`DROP TABLE "enrollment_family_talk_interests"`);
    await queryRunner.query(`SELECT set_config('app.audit', '', true)`);
  }

  public down(): Promise<void> {
    throw new Error(
      'CompanionTalkInterests no tiene vuelta atrás; restaura un respaldo.',
    );
  }
}
