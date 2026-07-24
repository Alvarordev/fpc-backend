import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Agent } from '../src/database/entities/agent.entity';
import { Enrollment } from '../src/database/entities/enrollment.entity';
import { Interaction } from '../src/database/entities/interaction.entity';
import { PatientDiagnosis } from '../src/database/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../src/database/entities/patient-insurance.entity';
import { PatientSisAffiliation } from '../src/database/entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from '../src/database/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../src/database/entities/patient-treatment.entity';
import { Patient } from '../src/database/entities/patient.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import { UsersService } from '../src/users/users.service';

describe('Enrollment wizard (e2e)', () => {
  const emailPrefix = 'p7-%@example.test';
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let users: UsersService;
  let jwt: JwtService;
  let token: string;
  let agent: Agent;

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
    await clearPromptSevenData(dataSource, emailPrefix);
    const agentUser = await users.create({
      email: 'p7-agent@example.test',
      password: 'password123',
      role: UserRole.AGENT,
    });
    agent = await dataSource.getRepository(Agent).save({
      userId: agentUser.id,
      fullName: 'Prompt Seven Agent',
      phone: '1',
    });
    token = await jwt.signAsync({ sub: agentUser.id, role: agentUser.role });
  });

  afterAll(async () => app.close());

  it('enrolls a patient with linked companion, clinical history, and symptom report', async () => {
    const response = await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Prompt Seven Patient',
          primaryPhone: '2',
          email: 'p7-patient@example.test',
        },
        companion: {
          fullName: 'Prompt Seven Companion',
          primaryPhone: '3',
          email: 'p7-companion@example.test',
          isPrimaryInformant: true,
        },
        affiliationType: 'FAMILY_FRIEND',
        interaction: { type: 'IN_PERSON', notes: 'Enrollment completed' },
        details: { currentDepartment: 'LIMA', requiresTranslation: true },
        insurance: { insuranceType: 'NONE' },
        sisAffiliation: { canAffiliate: true, comments: 'Start process' },
        diagnosis: { diagnosis: 'Breast cancer', cancerStage: 'STAGE_2' },
        treatment: { treatmentType: 'Chemotherapy' },
        medicalAppointments: [{ specialty: 'ONCOLOGY' }],
        symptomReport: { isPainPresent: true, painIntensity: 7 },
        currentlyReceivingTreatment: true,
        consentToContact: true,
        isOncologicalPatient: true,
        interactionQualityRating: 5,
      })
      .expect(201);

    const body = response.body as Enrollment & {
      patient: Patient;
      companion: Patient;
      interaction: Interaction;
    };
    expect(body.patient).toMatchObject({ role: 'PATIENT', status: 'ENROLLED' });
    expect(body.companion).toMatchObject({ role: 'COMPANION' });
    expect(body.interaction).toMatchObject({
      subjectPatientId: body.patient.id,
      interlocutorId: body.companion.id,
      purpose: 'ENROLLMENT',
      status: 'COMPLETED',
    });
    await expect(
      dataSource.getRepository(Enrollment).findOneByOrFail({ id: body.id }),
    ).resolves.toMatchObject({
      patientId: body.patient.id,
      companionId: body.companion.id,
    });
    await expect(
      dataSource.getRepository(PatientInsurance).findOneByOrFail({
        patientId: body.patient.id,
      }),
    ).resolves.toMatchObject({ interactionId: body.interaction.id });
    const diagnosis = await dataSource
      .getRepository(PatientDiagnosis)
      .findOneByOrFail({ patientId: body.patient.id });
    await expect(
      dataSource.getRepository(PatientTreatment).findOneByOrFail({
        patientId: body.patient.id,
      }),
    ).resolves.toMatchObject({ diagnosisId: diagnosis.id });
    await expect(
      dataSource.getRepository(PatientSisAffiliation).findOneByOrFail({
        patientId: body.patient.id,
      }),
    ).resolves.toMatchObject({ interactionId: body.interaction.id });
    await expect(
      dataSource.getRepository(PatientSymptomReport).findOneByOrFail({
        patientId: body.patient.id,
      }),
    ).resolves.toMatchObject({
      enrollmentId: body.id,
      interactionId: body.interaction.id,
      painIntensity: 7,
    });
  });

  it('rolls back all records when a late wizard validation fails', async () => {
    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Rollback Patient',
          primaryPhone: '4',
          email: 'p7-rollback@example.test',
        },
        affiliationType: 'SELF',
        interaction: { type: 'CALL' },
        insurance: { insuranceType: 'NONE' },
        treatment: { treatmentType: 'This has no diagnosis' },
      })
      .expect(400);

    await expect(
      dataSource.getRepository(Patient).count({
        where: { email: 'p7-rollback@example.test' },
      }),
    ).resolves.toBe(0);
    await expect(
      dataSource.getRepository(Interaction).count({
        where: { agentId: agent.id },
      }),
    ).resolves.toBe(0);
    await expect(dataSource.getRepository(Enrollment).count()).resolves.toBe(0);
    await expect(
      dataSource.getRepository(PatientInsurance).count(),
    ).resolves.toBe(0);
  });
});

async function clearPromptSevenData(
  dataSource: DataSource,
  emailPrefix: string,
) {
  const patientIds = `(SELECT id FROM patients WHERE email LIKE $1)`;
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
    `DELETE FROM interactions WHERE subject_patient_id IN ${patientIds} OR agent_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM patient_details WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(`DELETE FROM patients WHERE email LIKE $1`, [
    emailPrefix,
  ]);
  await dataSource.query(
    'DELETE FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)',
    [emailPrefix],
  );
  await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
    emailPrefix,
  ]);
}
