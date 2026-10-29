import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import migrationSource from '../src/database/data-source';
import { Agent } from '../src/database/entities/agent.entity';
import { Enrollment } from '../src/database/entities/enrollment.entity';
import { FollowUp } from '../src/database/entities/follow-up.entity';
import { PatientDiagnosis } from '../src/database/entities/patient-diagnosis.entity';
import { Patient } from '../src/database/entities/patient.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import { WidenAllNarrativeTextColumns1784919000000 } from '../src/database/migrations/1784919000000-WidenAllNarrativeTextColumns';
import { CatalogItem } from '../src/database/entities/catalog-item.entity';
import { CATALOG_ITEM_SEEDS } from '../src/database/seeds/staging/catalog-items';
import { UsersService } from '../src/modules/users/users.service';

// This suite changes column definitions deliberately. Never run it on a shared DB.
// DATABASE_URL=postgresql://.../fpc_text_test npm run test:text:integration

describe('Narrative text on migrated PostgreSQL', () => {
  let app: INestApplication;
  let source: DataSource;
  let server: Server;
  let token: string;
  let agent: Agent;

  beforeAll(async () => {
    if (new URL(process.env.DATABASE_URL!).pathname !== '/fpc_text_test') {
      throw new Error('Use a disposable, empty database named fpc_text_test.');
    }
    await migrationSource.initialize();
    if (
      (
        await migrationSource.query<Array<{ count: string }>>(
          "SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'",
        )
      )[0].count !== '0'
    ) {
      throw new Error('The narrative regression database must be empty.');
    }
    // Migrate a real database up to the previous release, without synchronize.
    const previous = new DataSource({
      ...migrationSource.options,
      migrations: migrationSource.migrations
        .filter(
          (migration) =>
            !(migration instanceof WidenAllNarrativeTextColumns1784919000000),
        )
        .map(
          (migration) => migration.constructor as new () => typeof migration,
        ),
    });
    await previous.initialize();
    await previous.runMigrations();
    await previous.destroy();
    await migrationSource
      .createQueryBuilder()
      .insert()
      .into(CatalogItem)
      .values(
        CATALOG_ITEM_SEEDS.map((seed) => ({
          ...seed,
          parentCode: seed.parentCode ?? null,
          sortOrder: seed.sortOrder ?? 0,
          isActive: true,
          isSystem: seed.isSystem ?? false,
          metadata: seed.metadata ?? null,
        })),
      )
      .orIgnore()
      .execute();

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useLogger(false);
    await app.init();
    server = app.getHttpServer() as Server;
    source = app.get(DataSource);
    const users = app.get(UsersService);
    const admin = await users.create({
      email: 'text-admin@example.test',
      password: 'password123',
      role: UserRole.ADMIN,
    });
    const agentUser = await users.create({
      email: 'text-agent@example.test',
      password: 'password123',
      role: UserRole.AGENT,
    });
    agent = await source
      .getRepository(Agent)
      .save({ userId: agentUser.id, fullName: 'Agente de prueba', phone: '1' });
    token = await app
      .get(JwtService)
      .signAsync({ sub: admin.id, role: admin.role });
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    if (migrationSource.isInitialized) await migrationSource.destroy();
  });

  it('repairs legacy limits, preserves data, and saves long historical and operational records without truncation', async () => {
    const text = 'Evolución, síntomas y observaciones clínicas. 🩺\n'
      .repeat(140)
      .trim();
    const payload = (name: string, narrative: string) => ({
      patient: { fullName: name, primaryPhone: '123456789' },
      enrolledOn: '2024-09-01',
      affiliationType: 'SELF',
      healthPhase: 'CANCER_DIAGNOSIS',
      followUp: {
        type: 'IN_PERSON',
        status: 'COMPLETED',
        agentId: agent.id,
        completedOn: '2024-09-01',
        notes: narrative,
      },
      diagnosis: {
        diagnosis: 'MAMA_DUCTAL',
        mode: 'PARALLEL',
        symptomLeadingToCheckup: narrative,
        diseaseEvolution: narrative,
      },
      currentlyAttendingConsultations: false,
      currentlyReceivingTreatment: false,
      notAttendingConsultationsNote: narrative,
      notReceivingTreatmentReason: narrative,
      caseComments: narrative,
    });
    const post = (body: object) =>
      request(server)
        .post('/historical-records/enrollments')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    const existing = await post(
      payload('Registro previo', 'Texto original con tildes.'),
    )
      .expect((response) => {
        if (response.status !== 201)
          throw new Error(JSON.stringify(response.body));
      })
      .expect(201);

    // Reproduce schema drift across ALL text entity fields, not only the reported one.
    const textColumns = source.entityMetadatas.flatMap((entity) =>
      entity.columns
        .filter((column) => column.type === 'text')
        .map((column) => ({
          table: entity.tableName,
          column: column.databaseName,
        })),
    );
    for (const { table, column } of textColumns) {
      await source.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE varchar(255)`,
      );
    }
    await post(
      payload('Intento fallido', 'Síntoma histórico. '.repeat(24)),
    ).expect(500);
    expect(
      await source
        .getRepository(Patient)
        .existsBy({ fullName: 'Intento fallido' }),
    ).toBe(false);

    const migrations = await migrationSource.runMigrations();
    expect(migrations.map((migration) => migration.name)).toEqual([
      'WidenAllNarrativeTextColumns1784919000000',
    ]);
    expect(await migrationSource.runMigrations()).toHaveLength(0);
    // Running up again must also be safe for databases that already use text.
    const runner = source.createQueryRunner();
    try {
      await new WidenAllNarrativeTextColumns1784919000000().up(runner);
    } finally {
      await runner.release();
    }
    for (const { table, column } of textColumns) {
      const [actual] = await source.query<
        Array<{ data_type: string; character_maximum_length: number | null }>
      >(
        'SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2',
        [table, column],
      );
      expect({ table, column, ...actual }).toEqual({
        table,
        column,
        data_type: 'text',
        character_maximum_length: null,
      });
    }
    const oldDiagnosis = await source
      .getRepository(PatientDiagnosis)
      .findOneByOrFail({
        patientId: (existing.body as { patientId: string }).patientId,
      });
    expect(oldDiagnosis.symptomLeadingToCheckup).toBe(
      'Texto original con tildes.',
    );

    const created = await post(payload('Carga histórica larga', text)).expect(
      201,
    );
    const patientId = (created.body as { patientId: string }).patientId;
    const diagnosis = await source
      .getRepository(PatientDiagnosis)
      .findOneByOrFail({ patientId });
    expect(diagnosis.symptomLeadingToCheckup).toBe(text);
    expect(diagnosis.diseaseEvolution).toBe(text);
    const enrollment = await source
      .getRepository(Enrollment)
      .findOneByOrFail({ patientId });
    expect(enrollment.caseComments).toBe(text);
    expect(enrollment.notAttendingConsultationsNote).toBe(text);
    expect(enrollment.notReceivingTreatmentReason).toBe(text);
    expect(
      (
        await source
          .getRepository(FollowUp)
          .findOneByOrFail({ id: enrollment.followUpId })
      ).notes,
    ).toBe(text);

    await request(server)
      .patch(`/patients/${patientId}/diagnoses/${diagnosis.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        diseaseEvolution: text + 'Actualización.',
        followUpId: enrollment.followUpId,
        changeReason: text,
      })
      .expect(200);
    expect(
      (
        await source
          .getRepository(PatientDiagnosis)
          .findOneByOrFail({ id: diagnosis.id })
      ).diseaseEvolution,
    ).toBe(text + 'Actualización.');

    const reminder = await request(server)
      .post('/historical-records/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subjectPatientId: patientId,
        assignedAgentId: agent.id,
        dueOn: '2024-09-02',
        status: 'PENDING',
        description: text,
      })
      .expect(201);
    expect((reminder.body as { description: string }).description).toBe(text);
    const updated = await request(server)
      .patch(
        `/historical-records/reminders/${(reminder.body as { id: string }).id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ description: text + 'Editado.' })
      .expect(200);
    expect((updated.body as { description: string }).description).toBe(
      text + 'Editado.',
    );

    const operational = payload('Afiliación operativa larga', text);
    const operationalBody: Partial<typeof operational> = { ...operational };
    delete operationalBody.enrolledOn;
    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...operationalBody,
        followUp: { type: 'IN_PERSON', agentId: agent.id, notes: text },
      })
      .expect(201);

    const document = await request(server)
      .post(`/patients/${patientId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .field('documentType', 'OTHER')
      .field('description', text)
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect((document.body as { description: string }).description).toBe(text);
    const volunteer = await request(server)
      .post('/volunteers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'text-volunteer@example.test',
        password: 'password123',
        firstName: 'Prueba',
        lastName: 'Texto',
        specialty: 'PSICOLOGIA',
        phone: '123456789',
        additionalComments: text,
      })
      .expect(201);
    expect(
      (volunteer.body as { additionalComments: string }).additionalComments,
    ).toBe(text);
    const editedVolunteer = await request(server)
      .patch(`/volunteers/${(volunteer.body as { id: string }).id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ additionalComments: text + 'Editado.' })
      .expect(200);
    expect(
      (editedVolunteer.body as { additionalComments: string })
        .additionalComments,
    ).toBe(text + 'Editado.');

    // Technical/catalog values keep their explicit bounds and validation.
    await post({
      ...payload('Código inválido', ''),
      healthPhase: 'x'.repeat(101),
    }).expect(400);
  }, 60000);
});
