import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Agent } from '../src/database/entities/agent.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../src/database/entities/follow-up.enums';
import { FollowUp } from '../src/database/entities/follow-up.entity';
import {
  AppointmentModality,
  AppointmentStatus,
  PsychooncologyAppointment,
} from '../src/database/entities/psychooncology-appointment.entity';
import { ReminderStatus } from '../src/database/entities/reminder-status.enum';
import { Reminder } from '../src/database/entities/reminder.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import {
  AvailabilityStatus,
  VolunteerAvailability,
} from '../src/database/entities/volunteer-availability.entity';
import { Volunteer } from '../src/database/entities/volunteer.entity';
import { Patient } from '../src/database/entities/patient.entity';
import { UsersService } from '../src/modules/users/users.service';

describe('Patient timeline (e2e)', () => {
  const emailPrefix = 'timeline-%@example.test';
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let users: UsersService;
  let jwt: JwtService;
  let adminToken: string;
  let agentAToken: string;
  let volunteerAToken: string;
  let volunteerBToken: string;
  let agentA: Agent;
  let agentB: Agent;
  let volunteerA: Volunteer;
  let volunteerB: Volunteer;
  let emptyPatient: Patient;
  let patient: Patient;
  let otherPatient: Patient;
  let otherAgentFollowUp: FollowUp;
  let otherAgentReminder: Reminder;

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
    await clearTimelineData(dataSource, emailPrefix);
    const [adminUser, agentAUser, agentBUser, volunteerAUser, volunteerBUser] =
      await Promise.all([
        users.create({
          email: 'timeline-admin@example.test',
          password: 'password123',
          role: UserRole.ADMIN,
        }),
        users.create({
          email: 'timeline-agent-a@example.test',
          password: 'password123',
          role: UserRole.AGENT,
        }),
        users.create({
          email: 'timeline-agent-b@example.test',
          password: 'password123',
          role: UserRole.AGENT,
        }),
        users.create({
          email: 'timeline-volunteer-a@example.test',
          password: 'password123',
          role: UserRole.VOLUNTEER,
        }),
        users.create({
          email: 'timeline-volunteer-b@example.test',
          password: 'password123',
          role: UserRole.VOLUNTEER,
        }),
      ]);

    [agentA, agentB] = await dataSource.getRepository(Agent).save([
      { userId: agentAUser.id, fullName: 'Timeline Agent A', phone: '1' },
      { userId: agentBUser.id, fullName: 'Timeline Agent B', phone: '2' },
    ]);
    [volunteerA, volunteerB] = await dataSource.getRepository(Volunteer).save([
      {
        userId: volunteerAUser.id,
        firstName: 'Timeline',
        lastName: 'Volunteer A',
        specialty: 'Psycho-oncology',
        email: volunteerAUser.email,
        phone: '3',
      },
      {
        userId: volunteerBUser.id,
        firstName: 'Timeline',
        lastName: 'Volunteer B',
        specialty: 'Psycho-oncology',
        email: volunteerBUser.email,
        phone: '4',
      },
    ]);
    [emptyPatient, patient, otherPatient] = await dataSource
      .getRepository(Patient)
      .save([
        {
          fullName: 'Timeline Empty',
          primaryPhone: '5',
          email: 'timeline-empty@example.test',
        },
        {
          fullName: 'Timeline Patient',
          primaryPhone: '6',
          email: 'timeline-patient@example.test',
        },
        {
          fullName: 'Timeline Other Patient',
          primaryPhone: '7',
          email: 'timeline-other-patient@example.test',
        },
      ]);

    otherAgentFollowUp = await createFollowUp(
      dataSource,
      patient.id,
      agentB.id,
      new Date('2026-08-01T10:00:00.000Z'),
      'Other agent notes',
    );
    await createFollowUp(
      dataSource,
      patient.id,
      agentA.id,
      new Date('2026-08-02T10:00:00.000Z'),
      'Current agent notes',
    );
    otherAgentReminder = await dataSource.getRepository(Reminder).save({
      subjectPatientId: patient.id,
      createdFromFollowUpId: otherAgentFollowUp.id,
      assignedAgentId: agentB.id,
      dueAt: new Date('2026-08-04T10:00:00.000Z'),
      description: 'Other agent reminder',
      status: ReminderStatus.PENDING,
      completedAt: null,
      resultingFollowUpId: null,
    });
    await createAppointment(
      dataSource,
      patient.id,
      volunteerA.id,
      agentA.id,
      new Date('2026-08-03T10:00:00.000Z'),
      1,
    );
    await createAppointment(
      dataSource,
      patient.id,
      volunteerB.id,
      agentB.id,
      new Date('2026-08-05T10:00:00.000Z'),
      2,
    );
    await createAppointment(
      dataSource,
      otherPatient.id,
      volunteerB.id,
      agentB.id,
      new Date('2026-08-06T10:00:00.000Z'),
      1,
    );

    [adminToken, agentAToken, volunteerAToken, volunteerBToken] =
      await Promise.all([
        jwt.signAsync({ sub: adminUser.id, role: adminUser.role }),
        jwt.signAsync({ sub: agentAUser.id, role: agentAUser.role }),
        jwt.signAsync({ sub: volunteerAUser.id, role: volunteerAUser.role }),
        jwt.signAsync({ sub: volunteerBUser.id, role: volunteerBUser.role }),
      ]);
  });

  afterAll(async () => {
    await clearTimelineData(dataSource, emailPrefix);
    await app.close();
  });

  it('returns an empty timeline', async () => {
    const { body } = await request(server)
      .get(`/patients/${emptyPatient.id}/timeline`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(body).toEqual({ data: [], total: 0 });
  });

  it('normalizes linked events and orders them by occurredAt descending', async () => {
    const { body } = await request(server)
      .get(`/patients/${patient.id}/timeline`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      new Set(body.data.map((event: { kind: string }) => event.kind)),
    ).toEqual(new Set(['FOLLOW_UP', 'REMINDER', 'PSYCHOONCOLOGY_APPOINTMENT']));
    const dates = body.data.map(
      (event: { occurredAt: string }) => event.occurredAt,
    );
    expect(dates).toEqual([...dates].sort().reverse());
    expect(body.data).toContainEqual(
      expect.objectContaining({
        kind: 'REMINDER',
        followUpId: otherAgentFollowUp.id,
        occurredAt: '2026-08-04T10:00:00.000Z',
      }),
    );
  });

  it('paginates a stable global projection', async () => {
    const full = await request(server)
      .get(`/patients/${patient.id}/timeline?limit=100&offset=0`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const page = await request(server)
      .get(`/patients/${patient.id}/timeline?limit=2&offset=1`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(page.body.total).toBe(full.body.total);
    expect(page.body.data).toEqual(full.body.data.slice(1, 3));
  });

  it('returns 404 for a missing patient and validates pagination', async () => {
    await request(server)
      .get('/patients/00000000-0000-4000-8000-000000000000/timeline')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    await request(server)
      .get(`/patients/${patient.id}/timeline?limit=101`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('lets agents read integral history but only modify their resources', async () => {
    const timeline = await request(server)
      .get(`/patients/${patient.id}/timeline`)
      .set('Authorization', `Bearer ${agentAToken}`)
      .expect(200);
    expect(timeline.body.data).toContainEqual(
      expect.objectContaining({ id: otherAgentFollowUp.id, kind: 'FOLLOW_UP' }),
    );
    await request(server)
      .get(`/follow-ups/${otherAgentFollowUp.id}`)
      .set('Authorization', `Bearer ${agentAToken}`)
      .expect(200);
    const reminders = await request(server)
      .get('/reminders')
      .set('Authorization', `Bearer ${agentAToken}`)
      .expect(200);
    expect(reminders.body).toContainEqual(
      expect.objectContaining({ id: otherAgentReminder.id }),
    );
    await request(server)
      .patch(`/follow-ups/${otherAgentFollowUp.id}`)
      .set('Authorization', `Bearer ${agentAToken}`)
      .send({ notes: 'Denied' })
      .expect(403);
    await request(server)
      .patch(`/reminders/${otherAgentReminder.id}`)
      .set('Authorization', `Bearer ${agentAToken}`)
      .send({ description: 'Denied' })
      .expect(403);
  });

  it('lets volunteers read complete history only for assigned patients', async () => {
    const timeline = await request(server)
      .get(`/patients/${patient.id}/timeline`)
      .set('Authorization', `Bearer ${volunteerAToken}`)
      .expect(200);
    expect(timeline.body.data).toContainEqual(
      expect.objectContaining({ id: otherAgentFollowUp.id, kind: 'FOLLOW_UP' }),
    );
    expect(
      timeline.body.data.filter(
        (event: { kind: string }) =>
          event.kind === 'PSYCHOONCOLOGY_APPOINTMENT',
      ),
    ).toHaveLength(2);
    await request(server)
      .get(`/patients/${patient.id}`)
      .set('Authorization', `Bearer ${volunteerAToken}`)
      .expect(200);
    await request(server)
      .get(`/follow-ups/${otherAgentFollowUp.id}`)
      .set('Authorization', `Bearer ${volunteerAToken}`)
      .expect(200);
    const reminders = await request(server)
      .get('/reminders')
      .set('Authorization', `Bearer ${volunteerAToken}`)
      .expect(200);
    expect(reminders.body).toContainEqual(
      expect.objectContaining({ id: otherAgentReminder.id }),
    );
    await request(server)
      .patch(`/follow-ups/${otherAgentFollowUp.id}`)
      .set('Authorization', `Bearer ${volunteerAToken}`)
      .send({ notes: 'Denied' })
      .expect(403);
    await request(server)
      .get(`/patients/${otherPatient.id}/timeline`)
      .set('Authorization', `Bearer ${volunteerAToken}`)
      .expect(403);
    await request(server)
      .get(`/patients/${otherPatient.id}/timeline`)
      .set('Authorization', `Bearer ${volunteerBToken}`)
      .expect(200);
  });
});

async function createFollowUp(
  dataSource: DataSource,
  patientId: string,
  agentId: string,
  completedAt: Date,
  notes: string,
): Promise<FollowUp> {
  return dataSource.getRepository(FollowUp).save({
    subjectPatientId: patientId,
    interlocutorId: patientId,
    agentId,
    type: FollowUpType.CALL,
    status: FollowUpStatus.COMPLETED,
    purpose: FollowUpPurpose.FOLLOW_UP,
    scheduledAt: null,
    completedAt,
    notes,
    nextFollowUpId: null,
  });
}

async function createAppointment(
  dataSource: DataSource,
  patientId: string,
  volunteerId: string,
  agentId: string,
  scheduledAt: Date,
  sessionNumber: number,
): Promise<PsychooncologyAppointment> {
  const followUp = await dataSource.getRepository(FollowUp).save({
    subjectPatientId: patientId,
    interlocutorId: patientId,
    agentId,
    type: FollowUpType.VIDEO_CALL,
    status: FollowUpStatus.SCHEDULED,
    purpose: FollowUpPurpose.PSYCHOONCOLOGY_REFERRAL,
    scheduledAt,
    completedAt: null,
    notes: null,
    nextFollowUpId: null,
  });
  const date = scheduledAt.toISOString().slice(0, 10);
  const availability = await dataSource
    .getRepository(VolunteerAvailability)
    .save({
      volunteerId,
      date,
      startTime: `${String(8 + sessionNumber).padStart(2, '0')}:00:00`,
      endTime: `${String(9 + sessionNumber).padStart(2, '0')}:00:00`,
      status: AvailabilityStatus.RESERVED,
    });
  return dataSource.getRepository(PsychooncologyAppointment).save({
    patientId,
    volunteerId,
    followUpId: followUp.id,
    availabilityId: availability.id,
    patientEmail: null,
    sessionNumber,
    isAdditionalSession: false,
    modality: AppointmentModality.VIDEO_CALL,
    status: AppointmentStatus.SCHEDULED,
    scheduledAt,
    completedAt: null,
    topicAddressed: null,
    sessionDetails: null,
    additionalObservations: null,
    recommendations: null,
    referral: null,
  });
}

async function clearTimelineData(
  dataSource: DataSource,
  emailPrefix: string,
): Promise<void> {
  await dataSource.query(
    'DELETE FROM psychooncology_appointments WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE $1)',
    [emailPrefix],
  );
  await dataSource.query(
    'DELETE FROM volunteer_availability WHERE volunteer_id IN (SELECT id FROM volunteers WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))',
    [emailPrefix],
  );
  await dataSource.query(
    'DELETE FROM reminders WHERE subject_patient_id IN (SELECT id FROM patients WHERE email LIKE $1)',
    [emailPrefix],
  );
  await dataSource.query(
    'DELETE FROM follow_ups WHERE subject_patient_id IN (SELECT id FROM patients WHERE email LIKE $1)',
    [emailPrefix],
  );
  await dataSource.query('DELETE FROM patients WHERE email LIKE $1', [
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
  await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
    emailPrefix,
  ]);
}
