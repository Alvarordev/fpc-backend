import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Agent } from '../src/database/entities/agent.entity';
import { HealthCenter } from '../src/database/entities/health-center.entity';
import { Patient } from '../src/database/entities/patient.entity';
import { PatientRole } from '../src/database/entities/patient-role.enum';
import { UserRole } from '../src/database/entities/user-role.enum';
import { Volunteer } from '../src/database/entities/volunteer.entity';
import { UsersService } from '../src/modules/users/users.service';
import { MedicalAppointmentResponseDto } from '../src/modules/patients/clinical/medical-appointments/medical-appointments-response.dto';

describe('Global medical appointments (e2e)', () => {
  const emailPrefix = 'medappt-%@example.test';
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
    await clearData(dataSource, emailPrefix);
    const [adminUser, agentUser, volunteerUser] = await Promise.all([
      users.create({
        email: 'medappt-admin@example.test',
        password: 'password123',
        role: UserRole.ADMIN,
      }),
      users.create({
        email: 'medappt-agent@example.test',
        password: 'password123',
        role: UserRole.AGENT,
      }),
      users.create({
        email: 'medappt-volunteer@example.test',
        password: 'password123',
        role: UserRole.VOLUNTEER,
      }),
    ]);
    await dataSource.getRepository(Agent).save({
      userId: agentUser.id,
      fullName: 'Med Appt Agent',
      phone: '1',
    });
    volunteer = await dataSource.getRepository(Volunteer).save({
      userId: volunteerUser.id,
      firstName: 'Med',
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
          dni: '33333333',
          email: 'medappt-assigned@example.test',
          role: PatientRole.PATIENT,
        },
        {
          fullName: 'Unassigned Patient',
          primaryPhone: '4',
          dni: '44444444',
          email: 'medappt-unassigned@example.test',
          role: PatientRole.PATIENT,
        },
      ]);
    healthCenter = await dataSource.getRepository(HealthCenter).save({
      name: 'Med Appt Center',
      slug: 'medappt-center',
      department: 'LIMA',
    });
    [adminToken, agentToken, volunteerToken] = await Promise.all([
      jwt.signAsync({ sub: adminUser.id, role: adminUser.role }),
      jwt.signAsync({ sub: agentUser.id, role: agentUser.role }),
      jwt.signAsync({ sub: volunteerUser.id, role: volunteerUser.role }),
    ]);
    // Grant the volunteer access to assignedPatient only.
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

  it('creates a follow-up when the patient has none, and reuses it on a second appointment', async () => {
    const first = await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        patientId: assignedPatient.id,
        specialty: 'Oncología',
        healthCenterId: healthCenter.id,
      })
      .expect(201);
    const firstAppointment = first.body as MedicalAppointmentResponseDto;

    const second = await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        patientId: assignedPatient.id,
        specialty: 'Psicología',
        healthCenterId: healthCenter.id,
      })
      .expect(201);
    const secondAppointment = second.body as MedicalAppointmentResponseDto;

    expect(secondAppointment.followUpId).toBe(firstAppointment.followUpId);

    const followUp = await dataSource.query<{ notes: string }[]>(
      'SELECT notes FROM follow_ups WHERE id = $1',
      [firstAppointment.followUpId],
    );
    expect(followUp[0].notes).toBe('Cita registrada desde panel web');
  });

  it('accepts a valid appointmentTime and rejects an invalid one', async () => {
    const created = await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        patientId: assignedPatient.id,
        specialty: 'Oncología',
        appointmentTime: '14:30',
      })
      .expect(201);
    expect(
      (created.body as MedicalAppointmentResponseDto).appointmentTime,
    ).toBe('14:30:00');

    await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        patientId: assignedPatient.id,
        specialty: 'Psicología',
        appointmentTime: '25:00',
      })
      .expect(400);
  });

  it('creates a new version on PATCH, marks the old one superseded, and preserves the one-current invariant', async () => {
    const created = await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ patientId: assignedPatient.id, specialty: 'Oncología' })
      .expect(201);
    const original = created.body as MedicalAppointmentResponseDto;

    const patched = await request(server)
      .patch(`/medical-appointments/${original.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ appointmentTime: '10:00', changeReason: 'Reprogramada' })
      .expect(200);
    const updated = patched.body as MedicalAppointmentResponseDto;

    expect(updated.id).not.toBe(original.id);
    expect(updated.changeReason).toBe('Reprogramada');
    expect(updated.appointmentTime).toBe('10:00:00');

    const [{ count }] = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM patient_medical_appointments WHERE patient_id = $1 AND is_current = true',
      [assignedPatient.id],
    );
    expect(Number(count)).toBe(1);

    await request(server)
      .patch(`/medical-appointments/${original.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(400); // changeReason is required
  });

  it('rejects changing specialty via PATCH', async () => {
    const created = await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ patientId: assignedPatient.id, specialty: 'Oncología' })
      .expect(201);
    const original = created.body as MedicalAppointmentResponseDto;

    await request(server)
      .patch(`/medical-appointments/${original.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ specialty: 'Psicología', changeReason: 'Cambio de especialidad' })
      .expect(400);
  });

  it('scopes the global list to assigned patients for volunteers, with a correctly scoped total', async () => {
    await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ patientId: assignedPatient.id, specialty: 'Oncología' })
      .expect(201);
    await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ patientId: unassignedPatient.id, specialty: 'Oncología' })
      .expect(201);

    const listed = await request(server)
      .get('/medical-appointments')
      .set('Authorization', `Bearer ${volunteerToken}`)
      .expect(200);

    const body = listed.body as {
      data: MedicalAppointmentResponseDto[];
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].patientId).toBe(assignedPatient.id);
  });

  it('excludes superseded rows by default and includes them with includeHistory=true', async () => {
    const created = await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ patientId: assignedPatient.id, specialty: 'Oncología' })
      .expect(201);
    const original = created.body as MedicalAppointmentResponseDto;
    await request(server)
      .patch(`/medical-appointments/${original.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ changeReason: 'Reprogramada' })
      .expect(200);

    const currentOnly = await request(server)
      .get('/medical-appointments')
      .query({ patientId: assignedPatient.id })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (currentOnly.body as { data: MedicalAppointmentResponseDto[] }).data,
    ).toHaveLength(1);

    const withHistory = await request(server)
      .get('/medical-appointments')
      .query({ patientId: assignedPatient.id, includeHistory: true })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (withHistory.body as { data: MedicalAppointmentResponseDto[] }).data,
    ).toHaveLength(2);
  });

  it('accepts appointmentTime on the patient sub-resource create endpoint', async () => {
    const followUp = await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ patientId: assignedPatient.id, specialty: 'Oncología' })
      .expect(201);
    const followUpId = (followUp.body as MedicalAppointmentResponseDto)
      .followUpId;

    const created = await request(server)
      .post(`/patients/${assignedPatient.id}/medical-appointments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        followUpId,
        specialty: 'Psicología',
        appointmentTime: '09:15',
      })
      .expect(201);
    // The sub-resource create path returns the freshly-saved entity without
    // a DB round-trip, so the time isn't normalized to HH:mm:ss like the
    // global list/create paths (which reload via query builder).
    expect(created.body).toMatchObject({ appointmentTime: '09:15' });
  });

  async function clearData(ds: DataSource, prefix: string) {
    await ds.query(
      'DELETE FROM patient_medical_appointments WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE $1)',
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
      'medappt-center',
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
