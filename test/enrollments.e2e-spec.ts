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
import { FollowUp } from '../src/database/entities/follow-up.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../src/database/entities/follow-up.enums';
import { CompanionPatient } from '../src/database/entities/companion-patient.entity';
import { PatientDiagnosis } from '../src/database/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../src/database/entities/patient-insurance.entity';
import { PatientRole } from '../src/database/entities/patient-role.enum';
import { PatientSisAffiliation } from '../src/database/entities/patient-sis-affiliation.entity';
import { PatientStatus } from '../src/database/entities/patient-status.enum';
import { PatientSymptomReport } from '../src/database/entities/patient-symptom-report.entity';
import { PatientAddress } from '../src/database/entities/patient-address.entity';
import { PatientTreatment } from '../src/database/entities/patient-treatment.entity';
import { PatientMedicalAppointment } from '../src/database/entities/patient-medical-appointment.entity';
import { Patient } from '../src/database/entities/patient.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import { UsersService } from '../src/modules/users/users.service';

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
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'IN_PERSON', notes: 'Enrollment completed' },
        details: { birthDepartment: 'LIMA', requiresTranslation: true },
        addresses: [
          {
            type: 'PERMANENT',
            isPrimary: true,
            address: 'Av. Siempre Viva 123',
            district: 'Comas',
            department: 'LIMA',
          },
          {
            type: 'TEMPORARY',
            address: 'Jr. Provisional 456',
            district: 'Ate',
            department: 'LIMA',
          },
        ],
        insurance: { insuranceType: 'NONE' },
        sisAffiliation: { canAffiliate: true, comments: 'Start process' },
        diagnosis: {
          diagnosis: 'Breast cancer',
          cancerStage: 'STAGE_2',
          mode: 'PARALLEL',
        },
        treatments: [{ treatmentType: 'Chemotherapy' }],
        medicalAppointments: [
          {
            specialty: 'ONCOLOGY',
            nextAppointmentDate: '2030-02-01',
            nextAppointmentSpecialty: 'Radioterapia',
          },
        ],
        symptomReport: { isPainPresent: true, painIntensity: 7 },
        currentlyReceivingTreatment: true,
        consentToContact: true,
        consentToShareData: false,
        isOncologicalPatient: true,
      })
      .expect(201);

    const body = response.body as Enrollment;
    const [patient, companion, followUp] = await Promise.all([
      dataSource.getRepository(Patient).findOneByOrFail({ id: body.patientId }),
      dataSource
        .getRepository(Patient)
        .findOneByOrFail({ id: body.companionId! }),
      dataSource
        .getRepository(FollowUp)
        .findOneByOrFail({ id: body.followUpId }),
    ]);
    expect(patient).toMatchObject({ role: 'PATIENT', status: 'ENROLLED' });
    expect(companion).toMatchObject({ role: 'COMPANION' });
    expect(followUp).toMatchObject({
      subjectPatientId: patient.id,
      interlocutorId: companion.id,
      purpose: 'ENROLLMENT',
      status: 'COMPLETED',
    });
    await expect(
      dataSource.getRepository(Enrollment).findOneByOrFail({ id: body.id }),
    ).resolves.toMatchObject({
      patientId: patient.id,
      companionId: companion.id,
      consentToContact: true,
      consentToShareData: false,
    });
    await expect(
      dataSource.getRepository(PatientInsurance).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({ followUpId: followUp.id });
    const diagnosis = await dataSource
      .getRepository(PatientDiagnosis)
      .findOneByOrFail({ patientId: patient.id });
    await expect(
      dataSource.getRepository(PatientTreatment).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({ diagnosisId: diagnosis.id });
    await expect(
      dataSource.getRepository(PatientSisAffiliation).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({ followUpId: followUp.id });
    await expect(
      dataSource.getRepository(PatientSymptomReport).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({
      enrollmentId: body.id,
      followUpId: followUp.id,
      painIntensity: 7,
    });
    await expect(
      dataSource.getRepository(PatientMedicalAppointment).findOneByOrFail({
        patientId: patient.id,
      }),
    ).resolves.toMatchObject({
      nextAppointmentDate: '2030-02-01',
      nextAppointmentSpecialty: 'Radioterapia',
    });

    const addresses = await dataSource.getRepository(PatientAddress).find({
      where: { patientId: patient.id },
      order: { type: 'ASC' },
    });
    expect(addresses).toHaveLength(2);
    expect(addresses).toEqual([
      expect.objectContaining({
        type: 'PERMANENT',
        isPrimary: true,
        district: 'Comas',
        department: 'LIMA',
        followUpId: followUp.id,
      }),
      expect.objectContaining({
        type: 'TEMPORARY',
        isPrimary: false,
        district: 'Ate',
        followUpId: followUp.id,
      }),
    ]);
  });

  it('keeps parallel diagnoses active and replaces only the selected diagnosis', async () => {
    const patient = await dataSource.getRepository(Patient).save({
      fullName: 'Parallel Diagnosis Patient',
      primaryPhone: '18',
      email: 'p7-parallel-diagnosis@example.test',
      role: PatientRole.PATIENT,
      status: PatientStatus.ENROLLED,
    });
    const followUp = await dataSource.getRepository(FollowUp).save({
      subjectPatientId: patient.id,
      interlocutorId: patient.id,
      agentId: agent.id,
      type: FollowUpType.CALL,
      status: FollowUpStatus.COMPLETED,
      purpose: FollowUpPurpose.FIRST_CONTACT,
    });

    const createDiagnosis = (diagnosis: string) =>
      request(server)
        .post(`/patients/${patient.id}/diagnoses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          followUpId: followUp.id,
          diagnosis,
          mode: 'PARALLEL',
        })
        .expect(201);
    const first = (await createDiagnosis('First active diagnosis')).body as {
      id: string;
    };
    const second = (await createDiagnosis('Second active diagnosis')).body as {
      id: string;
    };

    await expect(
      dataSource.getRepository(PatientDiagnosis).find({
        where: { patientId: patient.id, isCurrent: true },
      }),
    ).resolves.toHaveLength(2);

    await request(server)
      .post(`/patients/${patient.id}/diagnoses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        followUpId: followUp.id,
        diagnosis: 'Replacement diagnosis',
        mode: 'REPLACE',
        replacementDiagnosisId: first.id,
      })
      .expect(201);

    const diagnoses = await dataSource.getRepository(PatientDiagnosis).find({
      where: { patientId: patient.id },
    });
    expect(diagnoses).toHaveLength(3);
    expect(diagnoses.find(({ id }) => id === first.id)?.isCurrent).toBe(false);
    expect(diagnoses.find(({ id }) => id === second.id)?.isCurrent).toBe(true);
    expect(diagnoses.filter((diagnosis) => diagnosis.isCurrent)).toHaveLength(
      2,
    );
  });

  it('records and updates the enrollment rating after enrollment', async () => {
    const enrollmentResponse = await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Post Enrollment Rating Patient',
          primaryPhone: '14',
          email: 'p7-rating@example.test',
        },
        affiliationType: 'SELF',
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        diagnosis: { diagnosis: 'Cancer diagnosis', mode: 'PARALLEL' },
      })
      .expect(201);
    const enrollment = enrollmentResponse.body as Enrollment;

    await request(server)
      .patch(`/enrollments/${enrollment.id}/survey`)
      .set('Authorization', `Bearer ${token}`)
      .send({ followUpQualityRating: 5 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: enrollment.id,
          followUpQualityRating: 5,
        });
      });

    await request(server)
      .patch(`/enrollments/${enrollment.id}/survey`)
      .set('Authorization', `Bearer ${token}`)
      .send({ followUpQualityRating: 3 })
      .expect(200)
      .expect(({ body }) => {
        expect((body as Enrollment).followUpQualityRating).toBe(3);
      });

    await expect(
      dataSource
        .getRepository(Enrollment)
        .findOneByOrFail({ id: enrollment.id }),
    ).resolves.toMatchObject({ followUpQualityRating: 3 });
  });

  it('rejects an enrollment rating outside the allowed range', async () => {
    const enrollmentResponse = await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Invalid Rating Patient',
          primaryPhone: '15',
          email: 'p7-invalid-rating@example.test',
        },
        affiliationType: 'SELF',
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        diagnosis: { diagnosis: 'Cancer diagnosis', mode: 'PARALLEL' },
      })
      .expect(201);
    const enrollment = enrollmentResponse.body as Enrollment;

    await request(server)
      .patch(`/enrollments/${enrollment.id}/survey`)
      .set('Authorization', `Bearer ${token}`)
      .send({ followUpQualityRating: 6 })
      .expect(400);

    await request(server)
      .patch('/enrollments/00000000-0000-0000-0000-000000000000/survey')
      .set('Authorization', `Bearer ${token}`)
      .send({ followUpQualityRating: 5 })
      .expect(404);
  });

  it('prevents an agent from changing another agent enrollment', async () => {
    const otherAgentUser = await users.create({
      email: 'p7-other-agent@example.test',
      password: 'password123',
      role: UserRole.AGENT,
    });
    await dataSource.getRepository(Agent).save({
      userId: otherAgentUser.id,
      fullName: 'Other Enrollment Agent',
      phone: '16',
    });
    const otherToken = await jwt.signAsync({
      sub: otherAgentUser.id,
      role: otherAgentUser.role,
    });
    const enrollmentResponse = await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Cross Agent Rating Patient',
          primaryPhone: '17',
          email: 'p7-cross-agent-rating@example.test',
        },
        affiliationType: 'SELF',
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        diagnosis: { diagnosis: 'Cancer diagnosis', mode: 'PARALLEL' },
      })
      .expect(201);
    const enrollment = enrollmentResponse.body as Enrollment;

    await request(server)
      .patch(`/enrollments/${enrollment.id}/survey`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ followUpQualityRating: 4 })
      .expect(403);
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
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        diagnosis: { diagnosis: 'Cancer diagnosis', mode: 'PARALLEL' },
      })
      .expect(201);
    const firstEnrollmentBody = firstEnrollment.body as Enrollment;

    const secondEnrollment = await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Second Shared Companion Patient',
          primaryPhone: '6',
          email: 'p7-second-shared@example.test',
        },
        companionId: firstEnrollmentBody.companionId,
        affiliationType: 'FAMILY_FRIEND',
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        diagnosis: { diagnosis: 'Cancer diagnosis', mode: 'PARALLEL' },
      })
      .expect(201);
    const secondEnrollmentBody = secondEnrollment.body as Enrollment;

    await expect(
      dataSource.getRepository(CompanionPatient).findOneByOrFail({
        companionId: firstEnrollmentBody.companionId!,
        patientId: secondEnrollmentBody.patientId,
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
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        diagnosis: { diagnosis: 'Cancer diagnosis', mode: 'PARALLEL' },
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
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        diagnosis: { diagnosis: 'Cancer diagnosis', mode: 'PARALLEL' },
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
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        diagnosis: { diagnosis: 'Cancer diagnosis', mode: 'PARALLEL' },
      })
      .expect(400);
  });

  it('creates multiple diagnoses and associates each enrollment treatment', async () => {
    const response = await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Multiple Clinical Records Patient',
          primaryPhone: '12',
          email: 'p7-multiple-records@example.test',
        },
        affiliationType: 'SELF',
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        diagnoses: [
          {
            clientRef: 'breast-diagnosis',
            diagnosis: 'Breast cancer',
            mode: 'PARALLEL',
          },
          {
            clientRef: 'thyroid-diagnosis',
            diagnosis: 'Thyroid cancer',
            mode: 'PARALLEL',
          },
        ],
        treatments: [
          {
            diagnosisRef: 'breast-diagnosis',
            treatmentType: 'Chemotherapy',
          },
          {
            diagnosisRef: 'breast-diagnosis',
            treatmentType: 'Radiotherapy',
          },
          {
            diagnosisRef: 'thyroid-diagnosis',
            treatmentType: 'Surgery',
          },
        ],
      })
      .expect(201);
    const enrollment = response.body as Enrollment;
    const [diagnoses, treatments] = await Promise.all([
      dataSource.getRepository(PatientDiagnosis).find({
        where: { patientId: enrollment.patientId },
        order: { diagnosis: 'ASC' },
      }),
      dataSource.getRepository(PatientTreatment).find({
        where: { patientId: enrollment.patientId },
        order: { treatmentType: 'ASC' },
      }),
    ]);

    expect(diagnoses).toHaveLength(2);
    expect(treatments).toHaveLength(3);
    const diagnosisByName = new Map(
      diagnoses.map((diagnosis) => [diagnosis.diagnosis, diagnosis.id]),
    );
    expect(treatments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          treatmentType: 'Chemotherapy',
          diagnosisId: diagnosisByName.get('Breast cancer'),
        }),
        expect.objectContaining({
          treatmentType: 'Radiotherapy',
          diagnosisId: diagnosisByName.get('Breast cancer'),
        }),
        expect.objectContaining({
          treatmentType: 'Surgery',
          diagnosisId: diagnosisByName.get('Thyroid cancer'),
        }),
      ]),
    );
  });

  it('requires a diagnosis for a cancer diagnosis enrollment', async () => {
    await request(server)
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: {
          fullName: 'Missing Cancer Diagnosis Patient',
          primaryPhone: '13',
          email: 'p7-missing-cancer-diagnosis@example.test',
        },
        affiliationType: 'SELF',
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
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
        healthPhase: 'CANCER_DIAGNOSIS',
        followUp: { type: 'CALL' },
        insurance: { insuranceType: 'NONE' },
        diagnoses: [
          {
            clientRef: 'rollback-diagnosis',
            diagnosis: 'Rollback diagnosis',
            mode: 'PARALLEL',
          },
        ],
        treatments: [
          {
            diagnosisRef: 'rollback-diagnosis',
            treatmentType: 'This treatment should roll back',
            isReferred: true,
          },
        ],
      })
      .expect(400);

    await expect(
      dataSource.getRepository(Patient).count({
        where: { email: 'p7-rollback@example.test' },
      }),
    ).resolves.toBe(0);
    await expect(
      dataSource.getRepository(FollowUp).count({
        where: { agentId: agent.id },
      }),
    ).resolves.toBe(0);
    // Scoped to this agent, like the assertions above: the database also holds
    // the demo dataset (`npm run seed:demo`) and rows from the other suites.
    const countForAgent = async (table: string): Promise<number> => {
      const [{ count }] = await dataSource.query<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM "${table}" t
           JOIN follow_ups f ON f.id = t.follow_up_id
          WHERE f.agent_id = $1`,
        [agent.id],
      );
      return count;
    };

    await expect(countForAgent('enrollments')).resolves.toBe(0);
    await expect(countForAgent('patient_insurance')).resolves.toBe(0);
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
  // Both reference follow_ups without ON DELETE CASCADE, so they must go
  // before the follow_ups delete below.
  await dataSource.query(
    `DELETE FROM patient_addresses WHERE patient_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM companion_patient WHERE patient_id IN ${patientIds} OR companion_id IN ${patientIds}`,
    [emailPrefix],
  );
  await dataSource.query(
    `DELETE FROM follow_ups WHERE subject_patient_id IN ${patientIds} OR agent_id IN (SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))`,
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
