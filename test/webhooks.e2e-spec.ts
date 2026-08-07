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
import { PatientStatus } from '../src/database/entities/patient-status.enum';
import { UserRole } from '../src/database/entities/user-role.enum';
import { UsersService } from '../src/modules/users/users.service';
import { N8nWebhookService } from '../src/integrations/n8n/n8n-webhook.service';
import { N8nWebhookEnvelope } from '../src/integrations/n8n/n8n-webhook.events';
import { AlertResponseDto } from '../src/modules/alerts/alert-response.dto';

describe('n8n webhook dispatch (e2e)', () => {
  const emailPrefix = 'hook-%@example.test';
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let users: UsersService;
  let jwt: JwtService;
  let agentToken: string;
  let assignedPatient: Patient;
  let healthCenter: HealthCenter;
  let dispatched: N8nWebhookEnvelope[];

  beforeAll(async () => {
    dispatched = [];
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(N8nWebhookService)
      .useValue({
        dispatch: (envelope: N8nWebhookEnvelope) => {
          dispatched.push(envelope);
          return Promise.resolve();
        },
      })
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
  });

  beforeEach(async () => {
    dispatched = [];
    await clearData(dataSource, emailPrefix);
    const agentUser = await users.create({
      email: 'hook-agent@example.test',
      password: 'password123',
      role: UserRole.AGENT,
    });
    await dataSource.getRepository(Agent).save({
      userId: agentUser.id,
      fullName: 'Hook Agent',
      phone: '1',
    });
    assignedPatient = await dataSource.getRepository(Patient).save({
      fullName: 'Hook Patient',
      primaryPhone: '3',
      dni: '55555555',
      email: 'hook-patient@example.test',
      role: PatientRole.PATIENT,
      status: PatientStatus.ENROLLED,
    });
    healthCenter = await dataSource.getRepository(HealthCenter).save({
      name: 'Hook Center',
      slug: 'hook-center',
      department: 'LIMA',
    });
    agentToken = await jwt.signAsync({
      sub: agentUser.id,
      role: agentUser.role,
    });
  });

  afterAll(async () => app.close());

  it('dispatches exactly one Alerta envelope with the created ticket on alert creation', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        healthCenterId: healthCenter.id,
        subjectPatientId: assignedPatient.id,
        title: 'Falta de transporte',
        description: 'No hay transporte disponible.',
      })
      .expect(201);
    const alert = created.body as AlertResponseDto;

    const alertaEnvelopes = dispatched.filter((e) => e.var === 'Alerta');
    expect(alertaEnvelopes).toHaveLength(1);
    expect(alertaEnvelopes[0].query.ticket).toBe(alert.ticketNumber);
    expect(alertaEnvelopes[0].query.nombre).toBe('Hook Patient');
  });

  it('dispatches AlertaResuelta with the resolved title prefix', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        healthCenterId: healthCenter.id,
        subjectPatientId: assignedPatient.id,
        title: 'Falta de transporte',
        description: 'No hay transporte disponible.',
      })
      .expect(201);
    const alert = created.body as AlertResponseDto;
    dispatched = [];

    await request(server)
      .patch(`/alerts/${alert.id}/resolve`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    const resueltaEnvelopes = dispatched.filter(
      (e) => e.var === 'AlertaResuelta',
    );
    expect(resueltaEnvelopes).toHaveLength(1);
    expect(resueltaEnvelopes[0].query.titulo).toBe(
      'Alerta resuelta: Falta de transporte',
    );
  });

  it('dispatches AlertaDerivar only when derivedTo changes', async () => {
    const created = await request(server)
      .post('/alerts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        healthCenterId: healthCenter.id,
        subjectPatientId: assignedPatient.id,
        title: 'Falta de transporte',
        description: 'No hay transporte disponible.',
      })
      .expect(201);
    const alert = created.body as AlertResponseDto;
    dispatched = [];

    await request(server)
      .patch(`/alerts/${alert.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ derivedTo: 'Defensoría del Paciente' })
      .expect(200);

    const derivarEnvelopes = dispatched.filter(
      (e) => e.var === 'AlertaDerivar',
    );
    expect(derivarEnvelopes).toHaveLength(1);
    expect(derivarEnvelopes[0].query.descripcion).toBe(
      'Alerta derivada a: Defensoría del Paciente',
    );

    dispatched = [];
    await request(server)
      .patch(`/alerts/${alert.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ underReview: true })
      .expect(200);
    expect(dispatched.filter((e) => e.var === 'AlertaDerivar')).toHaveLength(0);
  });

  it('dispatches exactly one Registro and one Cita per medical appointment on enrollment, and nothing on rollback', async () => {
    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        patient: {
          fullName: 'Hook Enrolled Patient',
          primaryPhone: '9',
          email: 'hook-enrolled@example.test',
        },
        affiliationType: 'SELF',
        followUp: { type: 'CALL' },
        insurance: { insuranceType: 'NONE' },
        diagnosis: { diagnosis: 'Breast cancer', cancerStage: 'STAGE_2' },
        medicalAppointments: [{ specialty: 'ONCOLOGY' }],
      })
      .expect(201);

    const registroEnvelopes = dispatched.filter((e) => e.var === 'Registro');
    const citaEnvelopes = dispatched.filter((e) => e.var === 'Cita');
    expect(registroEnvelopes).toHaveLength(1);
    expect(registroEnvelopes[0].query.diagnostico).toBe('Breast cancer');
    expect(citaEnvelopes).toHaveLength(1);

    // Rollback proof: a wizard validation failure after the patient/appointment
    // inserts must not dispatch anything — the subscriber only fires after
    // the outermost commit, never on rollback.
    dispatched = [];
    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        patient: {
          fullName: 'Hook Rollback Patient',
          primaryPhone: '8',
          email: 'hook-rollback@example.test',
        },
        affiliationType: 'SELF',
        followUp: { type: 'CALL' },
        insurance: { insuranceType: 'NONE' },
        treatment: { treatmentType: 'No diagnosis behind this treatment' },
      })
      .expect(400);
    expect(dispatched).toHaveLength(0);
  });

  it('dispatches a Cita envelope with the appointment time on standalone medical-appointments create', async () => {
    await request(server)
      .post('/medical-appointments')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        patientId: assignedPatient.id,
        specialty: 'Oncología',
        appointmentTime: '14:30',
      })
      .expect(201);

    const citaEnvelopes = dispatched.filter((e) => e.var === 'Cita');
    expect(citaEnvelopes).toHaveLength(1);
    expect(citaEnvelopes[0].query.hora).toBe('14:30');
  });

  it('dispatches a Registro envelope with condicion "acompañante" when a companion is created', async () => {
    await request(server)
      .post(`/patients/${assignedPatient.id}/companions`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        fullName: 'Hook Companion',
        primaryPhone: '7',
        email: 'hook-companion@example.test',
      })
      .expect(201);

    const registroEnvelopes = dispatched.filter((e) => e.var === 'Registro');
    expect(registroEnvelopes).toHaveLength(1);
    expect(registroEnvelopes[0].query).toMatchObject({
      nombre: 'Hook Companion',
      condicion: 'acompañante',
    });
  });

  async function clearData(ds: DataSource, prefix: string) {
    await ds.query(
      'DELETE FROM alert_events WHERE alert_id IN (SELECT id FROM alerts WHERE created_by_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)))',
      [prefix],
    );
    await ds.query(
      'DELETE FROM companion_patient WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE $1) OR companion_id IN (SELECT id FROM patients WHERE email LIKE $1)',
      [prefix],
    );
    await ds.query(
      'DELETE FROM alerts WHERE created_by_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))',
      [prefix],
    );
    await ds.query(
      'DELETE FROM patient_medical_appointments WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE $1)',
      [prefix],
    );
    await ds.query(
      'DELETE FROM enrollments WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE $1)',
      [prefix],
    );
    await ds.query(
      'DELETE FROM patient_diagnoses WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE $1)',
      [prefix],
    );
    await ds.query(
      'DELETE FROM patient_insurance WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE $1)',
      [prefix],
    );
    await ds.query(
      'DELETE FROM follow_ups WHERE subject_patient_id IN (SELECT id FROM patients WHERE email LIKE $1) OR agent_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $2))',
      [prefix, prefix],
    );
    await ds.query('DELETE FROM health_centers WHERE slug = $1', [
      'hook-center',
    ]);
    await ds.query('DELETE FROM patients WHERE email LIKE $1', [prefix]);
    await ds.query(
      'DELETE FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)',
      [prefix],
    );
    await ds.query('DELETE FROM users WHERE email LIKE $1', [prefix]);
  }
});
