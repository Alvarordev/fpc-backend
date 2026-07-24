import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Agent } from '../src/database/entities/agent.entity';
import { PatientRole } from '../src/database/entities/patient-role.enum';
import { PatientStatus } from '../src/database/entities/patient-status.enum';
import { Patient } from '../src/database/entities/patient.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import { User } from '../src/database/entities/user.entity';
import { Volunteer } from '../src/database/entities/volunteer.entity';
import { UsersService } from '../src/users/users.service';

describe('Patients, agents and volunteers (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let users: UsersService;
  let jwt: JwtService;
  let adminToken: string;
  let volunteerToken: string;

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
    const httpServer: unknown = app.getHttpServer();
    server = httpServer as Server;
    dataSource = app.get(DataSource);
    users = app.get(UsersService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await dataSource
      .getRepository(Agent)
      .createQueryBuilder()
      .delete()
      .where('user_id IN (SELECT id FROM users WHERE email LIKE :prefix)', {
        prefix: 'crud-%@example.test',
      })
      .execute();
    await dataSource
      .getRepository(Volunteer)
      .createQueryBuilder()
      .delete()
      .where('user_id IN (SELECT id FROM users WHERE email LIKE :prefix)', {
        prefix: 'crud-%@example.test',
      })
      .execute();
    await dataSource
      .getRepository(Patient)
      .createQueryBuilder()
      .delete()
      .where(
        'accompanies_patient_id IN (SELECT id FROM patients WHERE email LIKE :prefix)',
        { prefix: 'crud-%@example.test' },
      )
      .execute();
    await dataSource
      .getRepository(Patient)
      .createQueryBuilder()
      .delete()
      .where('email LIKE :prefix', { prefix: 'crud-%@example.test' })
      .execute();
    await dataSource
      .getRepository(User)
      .createQueryBuilder()
      .delete()
      .where('email LIKE :prefix', { prefix: 'crud-%@example.test' })
      .execute();
    const admin = await users.create({
      email: 'crud-admin@example.test',
      password: 'password123',
      role: UserRole.ADMIN,
    });
    const volunteer = await users.create({
      email: 'crud-volunteer@example.test',
      password: 'password123',
      role: UserRole.VOLUNTEER,
    });
    adminToken = await jwt.signAsync({ sub: admin.id, role: admin.role });
    volunteerToken = await jwt.signAsync({
      sub: volunteer.id,
      role: volunteer.role,
    });
  });

  afterAll(async () => app.close());

  it('creates companions only for enrolled patients', async () => {
    const enrolled = await dataSource.getRepository(Patient).save({
      fullName: 'Enrolled',
      primaryPhone: '1',
      email: 'crud-enrolled@example.test',
      role: PatientRole.PATIENT,
      status: PatientStatus.ENROLLED,
    });
    await request(server)
      .post(`/patients/${enrolled.id}/companions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Companion', primaryPhone: '2' })
      .expect(201);
    const unEnrolled = await dataSource.getRepository(Patient).save({
      fullName: 'Unenrolled',
      primaryPhone: '3',
      email: 'crud-unenrolled@example.test',
      role: PatientRole.PATIENT,
      status: PatientStatus.UNENROLLED,
    });
    await request(server)
      .post(`/patients/${unEnrolled.id}/companions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Blocked', primaryPhone: '4' })
      .expect(409);
  });

  it('validates deactivation detail in both directions', async () => {
    const patient = await dataSource.getRepository(Patient).save({
      fullName: 'Deactivate',
      primaryPhone: '1',
      email: 'crud-deactivate@example.test',
    });
    const endpoint = `/patients/${patient.id}/deactivate`;
    await request(server)
      .patch(endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'OTHER' })
      .expect(400);
    await request(server)
      .patch(endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'LOST_CONTACT', detail: 'not allowed' })
      .expect(400);
    await request(server)
      .patch(endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'OTHER', detail: 'requested removal' })
      .expect(200);
  });

  it('rolls back duplicate personnel creation without orphan profiles', async () => {
    const body = {
      email: 'crud-agent@example.test',
      password: 'password123',
      fullName: 'Agent',
      phone: '1',
    };
    await request(server)
      .post('/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(201);
    await request(server)
      .post('/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(409);
    await expect(
      dataSource
        .getRepository(Agent)
        .count({ where: { user: { email: body.email } } }),
    ).resolves.toBe(1);
    await expect(
      dataSource.getRepository(User).count({ where: { email: body.email } }),
    ).resolves.toBe(1);

    const volunteer = {
      email: 'crud-volunteer-profile@example.test',
      password: 'password123',
      firstName: 'Volunteer',
      lastName: 'One',
      specialty: 'Support',
      phone: '2',
    };
    await request(server)
      .post('/volunteers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(volunteer)
      .expect(201);
    await request(server)
      .post('/volunteers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(volunteer)
      .expect(409);
    await expect(
      dataSource
        .getRepository(Volunteer)
        .count({ where: { user: { email: volunteer.email } } }),
    ).resolves.toBe(1);
    await expect(
      dataSource
        .getRepository(User)
        .count({ where: { email: volunteer.email } }),
    ).resolves.toBe(1);
  });

  it('allows volunteers to read patients but not write them', async () => {
    const patient = await dataSource.getRepository(Patient).save({
      fullName: 'Read',
      primaryPhone: '1',
      email: 'crud-read@example.test',
    });
    await request(server)
      .get('/patients')
      .set('Authorization', `Bearer ${volunteerToken}`)
      .expect(200);
    await request(server)
      .get(`/patients/${patient.id}`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .expect(200);
    await request(server)
      .post('/patients')
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ fullName: 'Denied', primaryPhone: '2' })
      .expect(403);
    await request(server)
      .patch(`/patients/${patient.id}`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ fullName: 'Denied' })
      .expect(403);
    await request(server)
      .put(`/patients/${patient.id}/details`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({})
      .expect(403);
  });
});
