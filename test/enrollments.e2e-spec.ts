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
import {
  InteractionPurpose,
  InteractionStatus,
  InteractionType,
} from '../src/database/entities/interaction.enums';
import { CompanionPatient } from '../src/patients/entities/companion-patient.entity';
import { PatientDiagnosis } from '../src/patients/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../src/patients/entities/patient-insurance.entity';
import { PatientRole } from '../src/patients/entities/patient-role.enum';
import { PatientSisAffiliation } from '../src/patients/entities/patient-sis-affiliation.entity';
import { PatientStatus } from '../src/patients/entities/patient-status.enum';
import { PatientSymptomReport } from '../src/patients/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../src/patients/entities/patient-treatment.entity';
import { Patient } from '../src/patients/entities/patient.entity';
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
        consentToShareData: false,
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
      consentToContact: true,
      consentToShareData: false,
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

  it('links an existing companion to a second patient as primary informant', async () => {
    const firstEnrollment = await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'First Shared Companion Patient',
          primaryPhone: '4',
          email: 'p7-first-shared@example.test',
        },
        companion: {
          fullName: 'Shared Companion',
          primaryPhone: '5',
          email: 'p7-shared-companion@example.test',
          isPrimaryInformant: true,
        },
        affiliationType: 'FAMILY_FRIEND',
        interaction: { type: 'CALL' },
      })
      .expect(201);
    const firstEnrollmentBody = firstEnrollment.body as {
      companion: Patient;
    };

    const secondEnrollment = await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Second Shared Companion Patient',
          primaryPhone: '6',
          email: 'p7-second-shared@example.test',
        },
        companionId: firstEnrollmentBody.companion.id,
        affiliationType: 'FAMILY_FRIEND',
        interaction: { type: 'CALL' },
      })
      .expect(201);
    const secondEnrollmentBody = secondEnrollment.body as { patient: Patient };

    await expect(
      dataSource.getRepository(CompanionPatient).findOneByOrFail({
        companionId: firstEnrollmentBody.companion.id,
        patientId: secondEnrollmentBody.patient.id,
      }),
    ).resolves.toMatchObject({ isPrimaryInformant: true });
  });

  it('rejects enrollment when patientId belongs to a companion', async () => {
    const companion = await dataSource.getRepository(Patient).save({
      fullName: 'Cannot Enroll Companion',
      primaryPhone: '7',
      email: 'p7-cannot-enroll-companion@example.test',
      role: PatientRole.COMPANION,
      status: PatientStatus.UNENROLLED,
    });

    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: companion.id,
        affiliationType: 'SELF',
        interaction: { type: 'CALL' },
      })
      .expect(409);
  });

  it('rejects FAMILY_FRIEND enrollment without a primary informant', async () => {
    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'No Primary Informant Patient',
          primaryPhone: '8',
          email: 'p7-no-primary@example.test',
        },
        companion: {
          fullName: 'Non-primary Companion',
          primaryPhone: '9',
          email: 'p7-non-primary@example.test',
          isPrimaryInformant: false,
        },
        affiliationType: 'FAMILY_FRIEND',
        interaction: { type: 'CALL' },
      })
      .expect(400);
  });

  it('rejects SELF enrollment with a primary informant', async () => {
    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Self Enrollment Patient',
          primaryPhone: '10',
          email: 'p7-self-primary@example.test',
        },
        companion: {
          fullName: 'Invalid Self Primary Informant',
          primaryPhone: '11',
          email: 'p7-self-primary-companion@example.test',
          isPrimaryInformant: true,
        },
        affiliationType: 'SELF',
        interaction: { type: 'CALL' },
      })
      .expect(400);
  });

  it('uses the current diagnosis for enrollment treatment and rejects when absent', async () => {
    const patient = await dataSource.getRepository(Patient).save({
      fullName: 'Existing Diagnosis Patient',
      primaryPhone: '12',
      email: 'p7-existing-diagnosis@example.test',
      role: PatientRole.PATIENT,
      status: PatientStatus.UNENROLLED,
    });
    const diagnosisInteraction = await dataSource
      .getRepository(Interaction)
      .save({
        subjectPatientId: patient.id,
        interlocutorId: patient.id,
        agentId: agent.id,
        type: InteractionType.CALL,
        status: InteractionStatus.COMPLETED,
        purpose: InteractionPurpose.FIRST_CONTACT,
      });
    const diagnosis = await dataSource.getRepository(PatientDiagnosis).save({
      patientId: patient.id,
      interactionId: diagnosisInteraction.id,
      diagnosis: 'Existing cancer diagnosis',
      isCurrent: true,
    });

    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patient.id,
        affiliationType: 'SELF',
        interaction: { type: 'CALL' },
        treatment: { treatmentType: 'Existing diagnosis treatment' },
      })
      .expect(201);

    await expect(
      dataSource.getRepository(PatientTreatment).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({ diagnosisId: diagnosis.id });

    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Missing Diagnosis Patient',
          primaryPhone: '13',
          email: 'p7-missing-diagnosis@example.test',
        },
        affiliationType: 'SELF',
        interaction: { type: 'CALL' },
        treatment: { treatmentType: 'Missing diagnosis treatment' },
      })
      .expect(400);
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
