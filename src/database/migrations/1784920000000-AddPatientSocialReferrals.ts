import { MigrationInterface, QueryRunner } from 'typeorm';

const CATALOG_ITEMS: Array<{
  kind: string;
  code: string;
  label: string;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
}> = [
  {
    kind: 'complaint_channel',
    code: 'LIBRO_RECLAMACIONES',
    label: 'Libro de reclamaciones',
    sortOrder: 10,
    metadata: null,
  },
  {
    kind: 'complaint_channel',
    code: 'PAUS_SIS',
    label: 'Plataforma de Atención al Usuario (SIS)',
    sortOrder: 20,
    metadata: {
      insuranceTypes: ['SIS'],
    },
  },
  {
    kind: 'complaint_channel',
    code: 'DEFENSORIA_ESSALUD',
    label: 'Defensoría del Asegurado (EsSalud)',
    sortOrder: 30,
    metadata: {
      insuranceTypes: ['ESSALUD'],
    },
  },
  {
    kind: 'complaint_channel',
    code: 'SUSALUD',
    label: 'SUSALUD',
    sortOrder: 40,
    metadata: null,
  },
  {
    kind: 'complaint_outcome',
    code: 'RESOLVED',
    label: 'Sí, se resolvió',
    sortOrder: 10,
    metadata: {
      description: 'Se resolvió el reclamo o queja del paciente.',
    },
  },
  {
    kind: 'complaint_outcome',
    code: 'NOT_RESOLVED',
    label: 'No se resolvió',
    sortOrder: 20,
    metadata: {
      description: 'No se resolvió el reclamo o queja.',
    },
  },
  {
    kind: 'complaint_outcome',
    code: 'NOT_RECEIVED',
    label: 'No fue recibido',
    sortOrder: 30,
    metadata: {
      description:
        'La oficina no recibió el caso, no levantó un informe o no respondió la llamada del paciente.',
    },
  },
  {
    kind: 'complaint_outcome',
    code: 'NOT_FILED',
    label: 'No lo presentó',
    sortOrder: 40,
    metadata: {
      description: 'El paciente no presentó su reclamo o queja.',
    },
  },
  {
    kind: 'complaint_outcome',
    code: 'NOT_NEEDED',
    label: 'No fue necesario',
    sortOrder: 50,
    metadata: {
      description:
        'El problema se resolvió antes de que el paciente presentara su caso.',
    },
  },
  {
    kind: 'complaint_outcome',
    code: 'NO_INFO',
    label: 'No hay información',
    sortOrder: 60,
    metadata: {
      closesReferral: false,
      description:
        'No se tiene información sobre la resolución del caso en el seguimiento.',
    },
  },
  {
    kind: 'complaint_outcome',
    code: 'PATIENT_UNREACHABLE',
    label: 'Paciente dejó de contestar',
    sortOrder: 70,
    metadata: {
      closesReferral: false,
      description: 'El paciente no responde llamadas ni mensajes.',
    },
  },
  {
    kind: 'complaint_outcome',
    code: 'PATIENT_DECEASED',
    label: 'Paciente falleció',
    sortOrder: 80,
    metadata: {
      description:
        'Falleció antes de poner el reclamo, durante el proceso o tras recibir la orientación.',
    },
  },
  {
    kind: 'complaint_outcome',
    code: 'CASE_CLOSED',
    label: 'Se cerró el caso',
    sortOrder: 90,
    metadata: {
      description:
        'Presentó el reclamo, pero el proceso no continuó porque se resolvió o la oficina lo cerró sin respuesta.',
    },
  },
  {
    kind: 'social_worker_outcome',
    code: 'EFFECTIVE',
    label: 'Sí, fue efectiva',
    sortOrder: 10,
    metadata: {
      description: 'La derivación fue efectiva.',
    },
  },
  {
    kind: 'social_worker_outcome',
    code: 'NOT_EFFECTIVE',
    label: 'No ayudó',
    sortOrder: 20,
    metadata: {
      description: 'No ayudó a resolver la necesidad del paciente.',
    },
  },
  {
    kind: 'social_worker_outcome',
    code: 'DID_NOT_GO',
    label: 'No se acercó',
    sortOrder: 30,
    metadata: {
      description: 'El paciente no fue a la oficina de asistencia social.',
    },
  },
  {
    kind: 'social_worker_outcome',
    code: 'NOT_REFERRED',
    label: 'No se derivó',
    sortOrder: 40,
    metadata: {
      description: 'El paciente no requiere el servicio.',
    },
  },
  {
    kind: 'social_worker_outcome',
    code: 'NO_INFO',
    label: 'No hay información',
    sortOrder: 50,
    metadata: {
      closesReferral: false,
      description:
        'No se tiene información de la efectividad en el seguimiento.',
    },
  },
  {
    kind: 'social_worker_outcome',
    code: 'OFFICE_CLOSED',
    label: 'Oficina cerrada',
    sortOrder: 60,
    metadata: {
      description: 'No encontró a nadie en la oficina o estaba cerrada.',
    },
  },
  {
    kind: 'fissal_outcome',
    code: 'YES_VIA_SEPA',
    label: 'Sí, por orientación de SEPA',
    sortOrder: 10,
    metadata: {
      description: 'Accedió a FISSAL por orientación de SEPA.',
    },
  },
  {
    kind: 'fissal_outcome',
    code: 'YES_WITHOUT_SEPA',
    label: 'Sí, sin orientación de SEPA',
    sortOrder: 20,
    metadata: {
      description: 'Accedió a FISSAL sin orientación de SEPA.',
    },
  },
  {
    kind: 'fissal_outcome',
    code: 'NOT_COVERED',
    label: 'No, cáncer no cubierto',
    sortOrder: 30,
    metadata: {
      description: 'No tiene uno de los 7 tipos de cáncer que cubre FISSAL.',
    },
  },
  {
    kind: 'fissal_outcome',
    code: 'DID_NOT_GO',
    label: 'No se acercó a la oficina',
    sortOrder: 40,
    metadata: {
      description:
        'Tiene un cáncer cubierto, pero no fue a la oficina ni llamó tras la orientación.',
    },
  },
  {
    kind: 'fissal_outcome',
    code: 'NO_INFO',
    label: 'No hay información',
    sortOrder: 50,
    metadata: {
      closesReferral: false,
      description:
        'No se tiene información en el seguimiento después de la derivación.',
    },
  },
  {
    kind: 'fissal_outcome',
    code: 'NO_BUDGET',
    label: 'FISSAL no tiene presupuesto',
    sortOrder: 60,
    metadata: {
      description:
        'Tiene un cáncer cubierto, pero no obtuvo el beneficio por falta de presupuesto.',
    },
  },
  {
    kind: 'fissal_outcome',
    code: 'PATIENT_DECEASED',
    label: 'Paciente falleció',
    sortOrder: 70,
    metadata: {
      description: 'Falleció mientras tramitaba el beneficio.',
    },
  },
  {
    kind: 'conadis_outcome',
    code: 'OBTAINED',
    label: 'Adquirió el carnet',
    sortOrder: 10,
    metadata: {
      description: 'El paciente obtuvo el carnet CONADIS.',
    },
  },
  {
    kind: 'conadis_outcome',
    code: 'NOT_OBTAINED',
    label: 'No adquirió el carnet',
    sortOrder: 20,
    metadata: {
      description: 'Hizo el trámite, pero no obtuvo el carnet.',
    },
  },
  {
    kind: 'conadis_outcome',
    code: 'DID_NOT_APPLY',
    label: 'No hizo el trámite',
    sortOrder: 30,
    metadata: {
      description:
        'Se brindó orientación, pero el paciente no realizó el trámite.',
    },
  },
];

// Social referrals (complaints, social worker, FISSAL, CONADIS) become cases
// with an append-only history of outcomes. Existing social notes are moved in
// as the history of one referral per patient and type.
export class AddPatientSocialReferrals1784920000000 implements MigrationInterface {
  name = 'AddPatientSocialReferrals1784920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "patient_social_referrals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL,
        "type" character varying(20) NOT NULL,
        "complaint_channel" character varying(100),
        "health_center_id" uuid,
        "issue" text,
        "note" text,
        "status" character varying(10) NOT NULL DEFAULT 'OPEN',
        "opened_at" date NOT NULL,
        "closed_at" date,
        "follow_up_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_patient_social_referrals" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_patient_social_referrals_type" CHECK ("type" IN ('COMPLAINT','SOCIAL_WORKER','FISSAL','CONADIS')),
        CONSTRAINT "CHK_patient_social_referrals_status" CHECK ("status" IN ('OPEN','CLOSED')),
        CONSTRAINT "CHK_patient_social_referrals_complaint" CHECK (("type" = 'COMPLAINT') = ("complaint_channel" IS NOT NULL AND "health_center_id" IS NOT NULL)),
        CONSTRAINT "FK_patient_social_referrals_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id"),
        CONSTRAINT "FK_patient_social_referrals_health_center" FOREIGN KEY ("health_center_id") REFERENCES "health_centers"("id"),
        CONSTRAINT "FK_patient_social_referrals_follow_up" FOREIGN KEY ("follow_up_id") REFERENCES "follow_ups"("id"),
        CONSTRAINT "FK_patient_social_referrals_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_social_referrals_patient_opened_at" ON "patient_social_referrals" ("patient_id", "opened_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_social_referrals_health_center_id" ON "patient_social_referrals" ("health_center_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "patient_social_referral_updates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "referral_id" uuid NOT NULL,
        "follow_up_id" uuid NOT NULL,
        "outcome" character varying(100) NOT NULL,
        "note" text,
        "author_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_patient_social_referral_updates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_patient_social_referral_updates_referral" FOREIGN KEY ("referral_id") REFERENCES "patient_social_referrals"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_patient_social_referral_updates_follow_up" FOREIGN KEY ("follow_up_id") REFERENCES "follow_ups"("id"),
        CONSTRAINT "FK_patient_social_referral_updates_author" FOREIGN KEY ("author_id") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_social_referral_updates_referral_created_at" ON "patient_social_referral_updates" ("referral_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_social_referral_updates_follow_up_id" ON "patient_social_referral_updates" ("follow_up_id")`,
    );

    for (const item of CATALOG_ITEMS) {
      await queryRunner.query(
        `INSERT INTO catalog_items (kind, code, label, sort_order, metadata, is_active, is_system)
         VALUES ($1, $2, $3, $4, $5, true, true)
         ON CONFLICT (kind, code) DO UPDATE SET
           label = EXCLUDED.label,
           sort_order = EXCLUDED.sort_order,
           metadata = EXCLUDED.metadata,
           is_active = true,
           is_system = true,
           updated_at = now()`,
        [
          item.kind,
          item.code,
          item.label,
          item.sortOrder,
          item.metadata ? JSON.stringify(item.metadata) : null,
        ],
      );
    }

    // One referral per patient and note type, opened by its earliest note.
    await queryRunner.query(`
      INSERT INTO "patient_social_referrals"
        ("patient_id", "type", "status", "opened_at", "follow_up_id", "created_by_id", "created_at")
      SELECT DISTINCT ON (n."patient_id", n."type")
        n."patient_id", n."type", 'OPEN',
        (n."created_at" AT TIME ZONE 'America/Lima')::date,
        n."follow_up_id", n."author_id", n."created_at"
      FROM "patient_social_notes" n
      ORDER BY n."patient_id", n."type", n."created_at", n."id"
    `);
    await queryRunner.query(`
      INSERT INTO "patient_social_referral_updates"
        ("referral_id", "follow_up_id", "outcome", "note", "author_id", "created_at")
      SELECT r."id", n."follow_up_id", 'NO_INFO', n."note", n."author_id", n."created_at"
      FROM "patient_social_notes" n
      JOIN "patient_social_referrals" r
        ON r."patient_id" = n."patient_id" AND r."type" = n."type"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "patient_social_referral_updates"`);
    await queryRunner.query(`DROP TABLE "patient_social_referrals"`);
    await queryRunner.query(
      `DELETE FROM catalog_items WHERE kind IN ('complaint_channel', 'complaint_outcome', 'social_worker_outcome', 'fissal_outcome', 'conadis_outcome')`,
    );
  }
}
