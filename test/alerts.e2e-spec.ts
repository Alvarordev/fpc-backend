import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Agent } from '../src/database/entities/agent.entity';
import { AlertEventResponseDto } from '../src/modules/alerts/dto/alert-event-response.dto';
import { AlertEventType } from '../src/database/entities/alert-event.entity';
import { AlertResponseDto } from '../src/modules/alerts/dto/alert-response.dto';
import { HealthCenter } from '../src/database/entities/health-center.entity';
import { Patient } from '../src/database/entities/patient.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import { Volunteer } from '../src/database/entities/volunteer.entity';
import { UsersService } from '../src/modules/users/users.service';

describe('Alert triage fields (e2e)', () => {
  const emailPrefix = 'alerts-%@example.test';
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let users: UsersService;
  let jwt: JwtService;
  let adminToken: string;
  let agentToken: string;
  let volunteerToken: string;
  let volunteer: Volunteer;
  let assignedPatient: Patient;
  let unassignedPatient: Patient;
  let healthCenter: HealthCenter;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
  });

  beforeEach(async () => {
    await clearAlertsData(dataSource, emailPrefix);
    const [adminUser, agentUser, volunteerUser] = await Promise.all([
      users.create({
        email: 'alerts-admin@example.test',
        password: 'password123',
        role: UserRole.ADMIN,
      }),
      users.create({
        email: 'alerts-agent@example.test',
        password: 'password123',
        role: UserRole.AGENT,
      }),
      users.create({
        email: 'alerts-volunteer@example.test',
        password: 'password123',
        role: UserRole.VOLUNTEER,
      }),
    ]);
    await dataSource.getRepository(Agent).save({
      userId: agentUser.id,
      fullName: 'Alerts Agent',
      phone: '1',
    });
    volunteer = await dataSource.getRepository(Volunteer).save({
      userId: volunteerUser.id,
      firstName: 'Alerts',
      lastName: 'Volunteer',
      specialty: 'Psycho-oncology',
      email: volunteerUser.email,
      phone: '2',
    });
    [assignedPatient, unassignedPatient] = await dataSource
      .getRepository(Patient)
      .save([
        {
          fullName: 'Assigned Patient',
          primaryPhone: '3',
          dni: '11111111',
          email: 'alerts-assigned@example.test',
        },
        {
          fullName: 'Unassigned Patient',
          primaryPhone: '4',
          dni: '22222222',
          email: 'alerts-unassigned@example.test',
        },
      ]);
    healthCenter = await dataSource.getRepository(HealthCenter).save({
      name: 'Alerts Center',
      slug: 'alerts-center',
      department: 'LIMA',
    });
    [adminToken, agentToken, volunteerToken] = await Promise.all([
      jwt.signAsync({ sub: adminUser.id, role: adminUser.role }),
      jwt.signAsync({ sub: agentUser.id, role: agentUser.role }),
      jwt.signAsync({ sub: volunteerUser.id, role: volunteerUser.role }),
    ]);
    // Grant the volunteer access to assignedPatient only, via a scheduled
    // psycho-oncology appointment (the only mechanism PatientAccessService uses).
    const availability = await request(server)
      .post(`/volunteers/${volunteer.id}/availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2030-01-01', startTime: '09:00', endTime: '10:00' })
      .expect(201);
    await request(server)
      .post('/psychooncology-appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId: assignedPatient.id,
        availabilityId: (availability.body as { id: string }).id,
        modality: 'CALL',
      })
      .expect(201);
  });

  afterAll(async () => app.close());

  function createBody(
    patientId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      healthCenterId: healthCenter.id,
      subjectPatientId: patientId,
      title: 'Transport interruption',
      description: 'No transport is available for the patient.',
      ...overrides,
    };
  }

  it('generates a strictly increasing ticket number matching ALT-<year>-<seq>', async () => {
    const first = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);
    const second = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);

    const firstAlert = first.body as AlertResponseDto;
    const secondAlert = second.body as AlertResponseDto;
    const ticketRegex = /^ALT-\d{4}-(\d+)$/;
    expect(firstAlert.ticketNumber).toMatch(ticketRegex);
    expect(secondAlert.ticketNumber).toMatch(ticketRegex);
    const firstSeq = Number(ticketRegex.exec(firstAlert.ticketNumber!)![1]);
    const secondSeq = Number(ticketRegex.exec(secondAlert.ticketNumber!)![1]);
    expect(secondSeq).toBeGreaterThan(firstSeq);
  });

  it('round-trips a supplied severity and category', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(
        createBody(assignedPatient.id, {
          severity: 'LOW',
          category: 'TRANSPORT',
        }),
      )
      .expect(201);

    expect(created.body).toMatchObject({
      severity: 'LOW',
      category: 'TRANSPORT',
    });
  });

  it('defaults severity and category when omitted', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);

    expect(created.body).toMatchObject({
      severity: 'HIGH',
      category: 'GENERAL',
    });
  });

  it('rejects an invalid severity', async () => {
    await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id, { severity: 'URGENT' }))
      .expect(400);
  });

  it('filters by severity and category', async () => {
    await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(
        createBody(assignedPatient.id, {
          severity: 'LOW',
          category: 'TRANSPORT',
        }),
      )
      .expect(201);
    await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);

    const filtered = await request(server)
      .get('/alerts')
      .query({ severity: 'LOW', category: 'TRANSPORT' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const items = filtered.body as AlertResponseDto[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.severity).toBe('LOW');
      expect(item.category).toBe('TRANSPORT');
    }
  });

  it('includes patient identity fields sourced from the follow-up subject patient', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);

    expect(created.body).toMatchObject({
      patientId: assignedPatient.id,
      patientFullName: 'Assigned Patient',
      patientDni: '11111111',
      patientPhone: '3',
    });
  });

  it('still scopes volunteers to alerts for assigned patients only', async () => {
    const forAssigned = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);
    await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(unassignedPatient.id))
      .expect(201);

    const visible = await request(server)
      .get('/alerts')
      .set('Authorization', `Bearer ${volunteerToken}`)
      .expect(200);

    const ids = (visible.body as AlertResponseDto[]).map((a) => a.id);
    expect(ids).toContain((forAssigned.body as AlertResponseDto).id);
    for (const item of visible.body as AlertResponseDto[]) {
      expect(item.patientId).toBe(assignedPatient.id);
    }
  });

  it('records exactly one CREATED event with the exact title on create', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);
    const alert = created.body as AlertResponseDto;

    const events = await request(server)
      .get(`/alerts/${alert.id}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const eventItems = events.body as AlertEventResponseDto[];
    expect(eventItems).toHaveLength(1);
    expect(eventItems[0]).toMatchObject({
      eventType: 'CREATED',
      title: `Alerta Reportada [Ticket ${alert.ticketNumber}]`,
    });
  });

  it('records a DERIVED event with the creating agent when derivedTo is set via PATCH', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);
    const alert = created.body as AlertResponseDto;

    await request(server)
      .patch(`/alerts/${alert.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ derivedTo: 'Defensoría del Paciente' })
      .expect(200);

    const events = await request(server)
      .get(`/alerts/${alert.id}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const derived = (
      events.body as { eventType: string; agentId: string }[]
    ).find((e) => e.eventType === 'DERIVED');
    expect(derived).toMatchObject({ agentId: alert.createdById });
  });

  it('forces new comment events to COMMENT and rejects a client-supplied eventType', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);
    const alert = created.body as AlertResponseDto;

    await request(server)
      .post(`/alerts/${alert.id}/events`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ title: 'Seguimiento', eventType: 'RESOLVED' })
      .expect(400);

    const added = await request(server)
      .post(`/alerts/${alert.id}/events`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ title: 'Seguimiento', description: 'Se llamó al centro.' })
      .expect(201);
    expect(added.body).toMatchObject({ eventType: 'COMMENT' });
  });

  it('deletes an alert and cascades its events at the database level, ADMIN only', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);
    const alert = created.body as AlertResponseDto;

    await request(server)
      .delete(`/alerts/${alert.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403);

    await request(server)
      .delete(`/alerts/${alert.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const remainingEvents = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM alert_events WHERE alert_id = $1',
      [alert.id],
    );
    expect(Number(remainingEvents[0].count)).toBe(0);
  });

  it('exposes the ticket lookup without authentication, including patient PII', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(unassignedPatient.id))
      .expect(201);
    const alert = created.body as AlertResponseDto;

    const found = await request(server)
      .get(`/alerts/ticket/${alert.ticketNumber}`)
      .expect(200);

    expect(found.body).toMatchObject({
      alert: { patientFullName: 'Unassigned Patient', patientDni: '22222222' },
      totalTimelineEvents: 1,
    });

    await request(server).get('/alerts/ticket/NOPE-DOES-NOT-EXIST').expect(404);
  });

  it('generates and stores an executive summary and appends an AI_SUMMARY_GENERATED event', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(createBody(assignedPatient.id))
      .expect(201);
    const alert = created.body as AlertResponseDto;

    await request(server)
      .post(`/alerts/${alert.id}/events`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ title: 'Seguimiento 1' })
      .expect(201);
    await request(server)
      .post(`/alerts/${alert.id}/events`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ title: 'Seguimiento 2' })
      .expect(201);

    const summarized = await request(server)
      .post(`/alerts/${alert.id}/ai-summary`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    const updated = summarized.body as AlertResponseDto;
    expect(updated.aiSummary).toMatch(/^📋 RESUMEN EJECUTIVO IA:/);
    expect(updated.aiSummary).toContain('2 avance(s)');

    const events = await request(server)
      .get(`/alerts/${alert.id}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const eventItems = events.body as AlertEventResponseDto[];
    const summaryEvent = eventItems.find(
      (e) => e.eventType === AlertEventType.AI_SUMMARY_GENERATED,
    );
    expect(summaryEvent).toBeDefined();
    expect(summaryEvent!.description).toBe(updated.aiSummary);
  });

  async function clearAlertsData(ds: DataSource, prefix: string) {
    await ds.query(
      'DELETE FROM alert_events WHERE alert_id IN (SELECT id FROM alerts WHERE created_by_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)))',
      [prefix],
    );
    await ds.query(
      'DELETE FROM alerts WHERE created_by_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))',
      [prefix],
    );
    await ds.query(
      'DELETE FROM psychooncology_appointments WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE $1) OR volunteer_id IN (SELECT id FROM volunteers WHERE user_id IN (SELECT id FROM users WHERE email LIKE $2))',
      [prefix, prefix],
    );
    await ds.query(
      'DELETE FROM follow_ups WHERE subject_patient_id IN (SELECT id FROM patients WHERE email LIKE $1) OR agent_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $2))',
      [prefix, prefix],
    );
    await ds.query(
      'DELETE FROM volunteer_availability WHERE volunteer_id IN (SELECT id FROM volunteers WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))',
      [prefix],
    );
    await ds.query('DELETE FROM health_centers WHERE slug = $1', [
      'alerts-center',
    ]);
    await ds.query('DELETE FROM patients WHERE email LIKE $1', [prefix]);
    await ds.query(
      'DELETE FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)',
      [prefix],
    );
    await ds.query(
      'DELETE FROM volunteers WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)',
      [prefix],
    );
    await ds.query('DELETE FROM users WHERE email LIKE $1', [prefix]);
  }
});
