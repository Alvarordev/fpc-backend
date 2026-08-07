import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Agent } from '../src/database/entities/agent.entity';
import { Alert } from '../src/database/entities/alert.entity';
import { HealthCenter } from '../src/database/entities/health-center.entity';
import { FollowUp } from '../src/database/entities/follow-up.entity';
import { Patient } from '../src/database/entities/patient.entity';
import { PsychooncologyAppointment } from '../src/database/entities/psychooncology-appointment.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import {
  AvailabilityStatus,
  VolunteerAvailability,
} from '../src/database/entities/volunteer-availability.entity';
import { Volunteer } from '../src/database/entities/volunteer.entity';
import { UsersService } from '../src/users/users.service';

describe('Availability, psycho-oncology appointments, and alerts (e2e)', () => {
  const emailPrefix = 'p6-%@example.test';
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let users: UsersService;
  let jwt: JwtService;
  let adminToken: string;
  let agentToken: string;
  let volunteerToken: string;
  let otherVolunteerToken: string;
  let volunteer: Volunteer;
  let otherVolunteer: Volunteer;
  let agent: Agent;
  let patient: Patient;
  let secondPatient: Patient;
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
    await clearPromptSixData(dataSource, emailPrefix);
    const [admin, agentUser, volunteerUser, otherVolunteerUser] =
      await Promise.all([
        users.create({
          email: 'p6-admin@example.test',
          password: 'password123',
          role: UserRole.ADMIN,
        }),
        users.create({
          email: 'p6-agent@example.test',
          password: 'password123',
          role: UserRole.AGENT,
        }),
        users.create({
          email: 'p6-volunteer@example.test',
          password: 'password123',
          role: UserRole.VOLUNTEER,
        }),
        users.create({
          email: 'p6-other-volunteer@example.test',
          password: 'password123',
          role: UserRole.VOLUNTEER,
        }),
      ]);
    volunteer = await dataSource.getRepository(Volunteer).save({
      userId: volunteerUser.id,
      firstName: 'Primary',
      lastName: 'Volunteer',
      specialty: 'Psycho-oncology',
      email: volunteerUser.email,
      phone: '1',
    });
    otherVolunteer = await dataSource.getRepository(Volunteer).save({
      userId: otherVolunteerUser.id,
      firstName: 'Other',
      lastName: 'Volunteer',
      specialty: 'Psycho-oncology',
      email: otherVolunteerUser.email,
      phone: '2',
    });
    agent = await dataSource.getRepository(Agent).save({
      userId: agentUser.id,
      fullName: 'Prompt Six Agent',
      phone: '3',
    });
    [patient, secondPatient] = await dataSource.getRepository(Patient).save([
      {
        fullName: 'Prompt Six Patient',
        primaryPhone: '4',
        email: 'p6-patient@example.test',
      },
      {
        fullName: 'Prompt Six Second Patient',
        primaryPhone: '5',
        email: 'p6-second-patient@example.test',
      },
    ]);
    healthCenter = await dataSource.getRepository(HealthCenter).save({
      name: 'Prompt Six Center',
      slug: 'p6-center',
      department: 'LIMA',
    });
    [adminToken, agentToken, volunteerToken, otherVolunteerToken] =
      await Promise.all([
        jwt.signAsync({ sub: admin.id, role: admin.role }),
        jwt.signAsync({ sub: agentUser.id, role: agentUser.role }),
        jwt.signAsync({ sub: volunteerUser.id, role: volunteerUser.role }),
        jwt.signAsync({
          sub: otherVolunteerUser.id,
          role: otherVolunteerUser.role,
        }),
      ]);
  });

  afterAll(async () => app.close());

  it('uses a pessimistic transaction so concurrent requests reserve a slot once', async () => {
    const availability = await createAvailability(volunteer.id, adminToken);
    const body = {
      availabilityId: availability.id,
      modality: 'VIDEO_CALL',
    };
    const responses = await Promise.all([
      request(server)
        .post('/psychooncology-appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...body, patientId: patient.id }),
      request(server)
        .post('/psychooncology-appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...body, patientId: secondPatient.id }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    await expect(
      dataSource.getRepository(PsychooncologyAppointment).count({
        where: { availabilityId: availability.id },
      }),
    ).resolves.toBe(1);
    await expect(
      dataSource.getRepository(VolunteerAvailability).findOneByOrFail({
        id: availability.id,
      }),
    ).resolves.toMatchObject({ status: AvailabilityStatus.RESERVED });
  });

  it('creates independent or linked appointments, releases cancelled slots, and numbers sessions', async () => {
    const availability = await createAvailability(volunteer.id, adminToken);
    const first = await request(server)
      .post('/psychooncology-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        patientId: patient.id,
        availabilityId: availability.id,
        modality: 'CALL',
      })
      .expect(201);
    const firstAppointment = first.body as PsychooncologyAppointment;
    expect(firstAppointment.sessionNumber).toBe(1);
    expect(firstAppointment.followUpId).toBeNull();

    const followUp = await dataSource.getRepository(FollowUp).save({
      subjectPatientId: patient.id,
      interlocutorId: patient.id,
      agentId: agent.id,
      purpose: 'PSYCHOONCOLOGY_REFERRAL',
      type: 'CALL',
      status: 'SCHEDULED',
      scheduledAt: null,
      completedAt: null,
      notes: null,
      nextFollowUpId: null,
    });

    await request(server)
      .patch(`/psychooncology-appointments/${firstAppointment.id}/cancel`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    await expect(
      dataSource.getRepository(VolunteerAvailability).findOneByOrFail({
        id: availability.id,
      }),
    ).resolves.toMatchObject({ status: AvailabilityStatus.AVAILABLE });

    const second = await request(server)
      .post('/psychooncology-appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId: patient.id,
        availabilityId: availability.id,
        modality: 'CALL',
        followUpId: followUp.id,
        isAdditionalSession: true,
      })
      .expect(201);
    expect(second.body).toMatchObject({
      sessionNumber: 2,
      followUpId: followUp.id,
    });
  });

  it('limits volunteers to their own availability and grants access after scheduling', async () => {
    await request(server)
      .post(`/volunteers/${otherVolunteer.id}/availability`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ date: '2030-01-01', startTime: '10:00', endTime: '11:00' })
      .expect(403);
    await request(server)
      .post(`/volunteers/${volunteer.id}/availability`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ date: '2030-01-01', startTime: '10:00', endTime: '11:00' })
      .expect(201);

    const otherAvailability = await createAvailability(
      otherVolunteer.id,
      adminToken,
    );
    await request(server)
      .post('/psychooncology-appointments')
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({
        patientId: patient.id,
        availabilityId: otherAvailability.id,
        modality: 'CALL',
      })
      .expect(403);
    const appointment = await request(server)
      .post('/psychooncology-appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId: patient.id,
        availabilityId: otherAvailability.id,
        modality: 'CALL',
      })
      .expect(201);
    const ownAvailability = await request(server)
      .post(`/volunteers/${volunteer.id}/availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2030-01-02', startTime: '10:00', endTime: '11:00' })
      .expect(201);
    await request(server)
      .post('/psychooncology-appointments')
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({
        patientId: patient.id,
        availabilityId: ownAvailability.body.id,
        modality: 'CALL',
      })
      .expect(201);
    await request(server)
      .get(
        `/psychooncology-appointments/${(appointment.body as { id: string }).id}`,
      )
      .set('Authorization', `Bearer ${volunteerToken}`)
      .expect(200);
    await request(server)
      .get('/psychooncology-appointments')
      .set('Authorization', `Bearer ${otherVolunteerToken}`)
      .expect(200)
      .expect(({ body }: { body: PsychooncologyAppointment[] }) => {
        expect(body).toContainEqual(
          expect.objectContaining({ volunteerId: otherVolunteer.id }),
        );
      });
  });

  it('restricts alert creation to agents but allows admins or agents to resolve', async () => {
    const body = {
      healthCenterId: healthCenter.id,
      subjectPatientId: patient.id,
      title: 'Transport interruption',
      description: 'No transport is available for the patient.',
    };
    await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(403);
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(body)
      .expect(201);
    const alert = created.body as Alert;
    await expect(
      dataSource.getRepository(FollowUp).findOneByOrFail({
        id: alert.followUpId,
      }),
    ).resolves.toMatchObject({
      subjectPatientId: patient.id,
      status: 'COMPLETED',
    });
    // Admins resolve on behalf of the org (resolvedByUserId), agents resolve
    // as themselves (resolvedById) — see AlertsService.resolve().
    await request(server)
      .patch(`/alerts/${alert.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body: resolved }: { body: Alert }) => {
        expect(resolved.status).toBe('RESOLVED');
        expect(resolved.resolvedByUserId).toBeTruthy();
        expect(resolved.resolvedById).toBeNull();
      });
    await request(server)
      .patch(`/alerts/${alert.id}/resolve`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(409); // already resolved by the admin above
  });

  it('rejects overlapping availability and preserves a no-answer slot', async () => {
    const availability = await createAvailability(volunteer.id, adminToken);
    await request(server)
      .post(`/volunteers/${volunteer.id}/availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2030-01-01', startTime: '09:30', endTime: '10:30' })
      .expect(409);

    const created = await request(server)
      .post('/psychooncology-appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId: patient.id,
        availabilityId: availability.id,
        modality: 'CALL',
      })
      .expect(201);
    const appointment = created.body as PsychooncologyAppointment;

    await request(server)
      .patch(`/psychooncology-appointments/${appointment.id}`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ status: 'NO_ANSWER' })
      .expect(200);
    await expect(
      dataSource.getRepository(VolunteerAvailability).findOneByOrFail({
        id: availability.id,
      }),
    ).resolves.toMatchObject({ status: AvailabilityStatus.RESERVED });
    await request(server)
      .patch(`/psychooncology-appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(409);
  });

  async function createAvailability(volunteerId: string, token: string) {
    const response = await request(server)
      .post(`/volunteers/${volunteerId}/availability`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2030-01-01', startTime: '09:00', endTime: '10:00' })
      .expect(201);
    return response.body as VolunteerAvailability;
  }
});

async function clearPromptSixData(dataSource: DataSource, emailPrefix: string) {
  await dataSource.query(
    'DELETE FROM alerts WHERE created_by_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))',
    [emailPrefix],
  );
  await dataSource.query(
    'DELETE FROM psychooncology_appointments WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE $1) OR volunteer_id IN (SELECT id FROM volunteers WHERE user_id IN (SELECT id FROM users WHERE email LIKE $2))',
    [emailPrefix, emailPrefix],
  );
  await dataSource.query(
    'DELETE FROM follow_ups WHERE subject_patient_id IN (SELECT id FROM patients WHERE email LIKE $1) OR agent_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $2))',
    [emailPrefix, emailPrefix],
  );
  await dataSource.query(
    'DELETE FROM volunteer_availability WHERE volunteer_id IN (SELECT id FROM volunteers WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))',
    [emailPrefix],
  );
  await dataSource.query('DELETE FROM health_centers WHERE slug = $1', [
    'p6-center',
  ]);
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
