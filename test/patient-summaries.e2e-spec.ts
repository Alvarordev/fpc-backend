import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  PatientSummary,
  PatientSummaryStatus,
} from '../src/database/entities/patient-summary.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import { GeminiSummaryClient } from '../src/patient-summaries/gemini-summary.client';
import {
  PATIENT_DATA_CHANGED,
  PatientDataChangedEvent,
} from '../src/patient-summaries/patient-data-changed.event';
import { PatientSummaryRateLimiterService } from '../src/patient-summaries/patient-summary-rate-limiter.service';
import { PatientRole } from '../src/database/entities/patient-role.enum';
import { PatientStatus } from '../src/database/entities/patient-status.enum';
import { Patient } from '../src/database/entities/patient.entity';
import { Agent } from '../src/database/entities/agent.entity';
import { PatientsService } from '../src/patients/patients.service';
import { UsersService } from '../src/users/users.service';
import { Volunteer } from '../src/database/entities/volunteer.entity';

type PatientListResponse = { data: Array<Record<string, unknown>> };
type EnrollmentResponse = { patientId: string };

describe('Patient summaries (e2e)', () => {
  const prefix = 'p10-%@example.test';
  const gemini = { generate: jest.fn() };
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let users: UsersService;
  let jwt: JwtService;
  let events: EventEmitter2;
  let adminToken: string;
  let volunteerToken: string;
  let assignedAgentId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeminiSummaryClient)
      .useValue(gemini)
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
    dataSource = app.get(DataSource);
    users = app.get(UsersService);
    jwt = app.get(JwtService);
    events = app.get(EventEmitter2);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    gemini.generate.mockReset();
    await clearSummaryData(dataSource, prefix);
    const admin = await users.create({
      email: 'p10-admin@example.test',
      password: 'password123',
      role: UserRole.ADMIN,
    });
    const volunteer = await users.create({
      email: 'p10-volunteer@example.test',
      password: 'password123',
      role: UserRole.VOLUNTEER,
    });
    const agentUser = await users.create({
      email: 'p10-agent@example.test',
      password: 'password123',
      role: UserRole.AGENT,
    });
    await dataSource.getRepository(Volunteer).save({
      userId: volunteer.id,
      firstName: 'Prompt Ten',
      lastName: 'Volunteer',
      specialty: 'Support',
      email: volunteer.email,
      phone: '998',
    });
    assignedAgentId = (
      await dataSource.getRepository(Agent).save({
        userId: agentUser.id,
        fullName: 'Prompt Ten Agent',
        phone: '999',
      })
    ).id;
    adminToken = await jwt.signAsync({ sub: admin.id, role: admin.role });
    volunteerToken = await jwt.signAsync({
      sub: volunteer.id,
      role: volunteer.role,
    });
  });

  afterAll(async () => app.close());

  it('generates and stores an on-demand summary, consuming the shared Gemini rate limit budget', async () => {
    // There is no background worker anymore (dropped in dd198c6) — on-demand
    // generation is the only caller of the Gemini provider, so it must go
    // through the shared PatientSummaryRateLimiterService budget itself;
    // that's the only thing protecting the Gemini API quota now.
    const patient = await createPatient(dataSource, 'success');
    gemini.generate.mockResolvedValue({
      text: 'Resumen generado bajo demanda',
      model: 'test-model',
    });
    const limiter = app.get(PatientSummaryRateLimiterService);
    const acquire = jest.spyOn(limiter, 'tryAcquire');

    await request(server)
      .get(`/patients/${patient.id}/summary`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect({
        status: 'READY',
        summary: 'Resumen generado bajo demanda',
        model: 'test-model',
        source: 'ON_DEMAND',
      });

    expect(acquire).toHaveBeenCalledTimes(1);
    await expect(
      dataSource.getRepository(PatientSummary).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({
      status: PatientSummaryStatus.READY,
      summary: 'Resumen generado bajo demanda',
    });
  });

  it('falls back to the stored summary and returns pending when none is available', async () => {
    const fallback = await createPatient(dataSource, 'fallback');
    const pending = await createPatient(dataSource, 'pending');
    await storeSummary(dataSource, fallback.id, 'Resumen almacenado');
    gemini.generate.mockRejectedValue(new Error('provider unavailable'));

    await request(server)
      .get(`/patients/${fallback.id}/summary`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect({
        status: 'READY',
        summary: 'Resumen almacenado',
        model: 'test-model',
        source: 'STORED',
      });
    await request(server)
      .get(`/patients/${pending.id}/summary`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect({
        status: 'PENDING',
        summary: null,
        model: null,
        source: 'PENDING',
      });
  });

  it('queues a pending summary from the patient-data event', async () => {
    const patient = await createPatient(dataSource, 'event');

    await events.emitAsync(
      PATIENT_DATA_CHANGED,
      new PatientDataChangedEvent(patient.id),
    );

    await expect(
      dataSource.getRepository(PatientSummary).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({ status: PatientSummaryStatus.PENDING });
  });

  it('invalidates stored summaries after real patient writes and omits them from lists', async () => {
    const patient = await createPatient(dataSource, 'invalidate');
    await storeSummary(dataSource, patient.id, 'Resumen anterior');

    await request(server)
      .patch(`/patients/${patient.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Prompt Ten Updated' })
      .expect(200);

    await expect(
      dataSource.getRepository(PatientSummary).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({
      status: PatientSummaryStatus.PENDING,
      summary: 'Resumen anterior',
    });
    const detail = await request(server)
      .get(`/patients/${patient.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body).toMatchObject({ summary: 'Resumen anterior' });
    const list = await request(server)
      .get('/patients?search=Prompt Ten Updated')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const listBody = list.body as PatientListResponse;
    expect(listBody.data[0]).not.toHaveProperty('summary');
  });

  it('does not invalidate a patient for companion-only operations', async () => {
    const patient = await createPatient(dataSource, 'companion');
    await storeSummary(dataSource, patient.id, 'No debe cambiar');

    await request(server)
      .post(`/patients/${patient.id}/companions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Prompt Ten Companion', primaryPhone: '999' })
      .expect(201);

    await expect(
      dataSource.getRepository(PatientSummary).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({
      status: PatientSummaryStatus.READY,
      summary: 'No debe cambiar',
    });
  });

  it('emits enrollment invalidation once after the outer transaction commits', async () => {
    const emit = jest.spyOn(events, 'emitAsync');

    const response = await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: {
          fullName: 'Prompt Ten Enrollment',
          primaryPhone: '998',
          email: 'p10-enrollment@example.test',
        },
        affiliationType: 'SELF',
        followUp: { type: 'CALL', agentId: assignedAgentId },
      })
      .expect(201);

    const enrollment = response.body as EnrollmentResponse;
    const calls = emit.mock.calls.filter(
      ([event, payload]) =>
        event === PATIENT_DATA_CHANGED &&
        payload instanceof PatientDataChangedEvent &&
        payload.patientId === enrollment.patientId,
    );
    expect(calls).toHaveLength(1);
    await expect(
      dataSource.getRepository(PatientSummary).findOneByOrFail({
        patientId: enrollment.patientId,
      }),
    ).resolves.toMatchObject({ status: PatientSummaryStatus.PENDING });
  });

  it('does not emit when an enrollment transaction rolls back', async () => {
    const emit = jest.spyOn(events, 'emitAsync');

    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: {
          fullName: 'Prompt Ten Rollback',
          primaryPhone: '997',
          email: 'p10-rollback@example.test',
        },
        affiliationType: 'SELF',
        followUp: { type: 'CALL', agentId: assignedAgentId },
        treatment: { treatmentType: 'Requires a diagnosis' },
      })
      .expect(400);

    expect(emit).not.toHaveBeenCalled();
  });

  it('defers external EntityManager invalidation until its transaction commits', async () => {
    const patient = await createPatient(dataSource, 'outer-transaction');
    await storeSummary(dataSource, patient.id, 'Antes de confirmar');
    const patients = app.get(PatientsService);

    await dataSource.transaction(async (manager) => {
      await patients.upsertDetails(
        patient.id,
        { currentDepartment: 'LIMA' },
        manager,
      );
      await expect(
        manager.getRepository(PatientSummary).findOneByOrFail({
          patientId: patient.id,
        }),
      ).resolves.toMatchObject({ status: PatientSummaryStatus.READY });
    });

    await expect(
      dataSource.getRepository(PatientSummary).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({ status: PatientSummaryStatus.PENDING });
  });

  it('rejects unauthenticated and unassigned volunteer summary requests', async () => {
    const patient = await createPatient(dataSource, 'roles');
    gemini.generate.mockResolvedValue({ text: 'Resumen', model: 'test-model' });

    await request(server).get(`/patients/${patient.id}/summary`).expect(401);
    await request(server)
      .get(`/patients/${patient.id}/summary`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .expect(403);
  });
});

async function createPatient(
  dataSource: DataSource,
  suffix: string,
): Promise<Patient> {
  return dataSource.getRepository(Patient).save({
    fullName: `Prompt Ten ${suffix}`,
    primaryPhone: '123',
    email: `p10-${suffix}@example.test`,
    role: PatientRole.PATIENT,
    status: PatientStatus.ENROLLED,
  });
}

async function storeSummary(
  dataSource: DataSource,
  patientId: string,
  summary: string,
): Promise<void> {
  await dataSource.getRepository(PatientSummary).save({
    patientId,
    status: PatientSummaryStatus.READY,
    summary,
    model: 'test-model',
    availableAt: new Date(),
    attemptCount: 0,
    processingStartedAt: null,
    completedAt: new Date(),
    errorCode: null,
    errorMessage: null,
  });
}

async function clearSummaryData(dataSource: DataSource, emailPrefix: string) {
  const patientIds = `(SELECT id FROM patients WHERE email LIKE $1)`;
  await dataSource.query(
    `DELETE FROM patient_summaries WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM patient_details WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM patient_symptom_reports WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM enrollments WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM patient_treatments WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM patient_diagnoses WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM patient_insurance WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM patient_sis_affiliation WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM patient_medical_appointments WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM companion_patient WHERE patient_id IN ${patientIds} OR companion_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM follow_ups WHERE subject_patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(`DELETE FROM patients WHERE email LIKE $1`, [
    emailPrefix,
  ]);
  await dataSource.query(
    'DELETE FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)',
    [emailPrefix],
  );
  await dataSource.query(
    'DELETE FROM volunteers WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)',
    [emailPrefix],
  );
  await dataSource.query(`DELETE FROM users WHERE email LIKE $1`, [
    emailPrefix,
  ]);
}
