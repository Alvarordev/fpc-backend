import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PatientDiagnosis } from '../src/database/entities/patient-diagnosis.entity';
import { PatientRole } from '../src/database/entities/patient-role.enum';
import { PatientTreatment } from '../src/database/entities/patient-treatment.entity';
import { PatientDocumentType } from '../src/database/entities/patient-document.entity';
import { Patient } from '../src/database/entities/patient.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import { UsersService } from '../src/modules/users/users.service';

describe('Patient documents (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let users: UsersService;
  let jwt: JwtService;
  let adminToken: string;
  let volunteerToken: string;
  let patient: Patient;
  let diagnosis: PatientDiagnosis;
  let treatment: PatientTreatment;

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

    patient = await dataSource
      .getRepository(Patient)
      .findOneByOrFail({ role: PatientRole.PATIENT });
    diagnosis = await dataSource
      .getRepository(PatientDiagnosis)
      .findOneByOrFail({ patientId: patient.id });
    treatment = await dataSource
      .getRepository(PatientTreatment)
      .findOneByOrFail({ patientId: patient.id });

    const suffix = Date.now();
    const [admin, volunteer] = await Promise.all([
      users.create({
        email: `documents-admin-${suffix}@example.test`,
        password: 'password123',
        role: UserRole.ADMIN,
      }),
      users.create({
        email: `documents-volunteer-${suffix}@example.test`,
        password: 'password123',
        role: UserRole.VOLUNTEER,
      }),
    ]);
    adminToken = await jwt.signAsync({ sub: admin.id, role: admin.role });
    volunteerToken = await jwt.signAsync({
      sub: volunteer.id,
      role: volunteer.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('uploads, streams, archives, and protects a patient document', async () => {
    const endpoint = `/patients/${patient.id}/documents`;
    const content = Buffer.from('%PDF-1.7\npatient report');

    await request(server).get(endpoint).expect(401);
    await request(server)
      .get(endpoint)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .expect(403);

    const upload = await request(server)
      .post(endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('documentType', PatientDocumentType.MEDICAL_REPORT)
      .field('diagnosisId', diagnosis.id)
      .attach('file', content, {
        filename: 'informe.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const documentId = (upload.body as { id: string }).id;

    expect(upload.body).toMatchObject({
      patientId: patient.id,
      documentType: PatientDocumentType.MEDICAL_REPORT,
      diagnosisId: diagnosis.id,
      treatmentId: null,
      status: 'ACTIVE',
      originalFileName: 'informe.pdf',
      mediaType: 'application/pdf',
      sizeBytes: content.length,
    });

    const listed = await request(server)
      .get(endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const listedBody = listed.body as {
      data: Array<{ id: string; status: string }>;
    };
    expect(listedBody.data).toContainEqual(
      expect.objectContaining({ id: documentId, status: 'ACTIVE' }),
    );

    const streamed = await request(server)
      .get(`${endpoint}/${documentId}/content`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(streamed.headers['content-type']).toContain('application/pdf');
    expect(streamed.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(streamed.body).toString()).toBe(content.toString());

    const archived = await request(server)
      .patch(`${endpoint}/${documentId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const archivedBody = archived.body as {
      id: string;
      status: string;
      archivedById: string;
      archivedAt: string;
    };
    expect(archivedBody.id).toBe(documentId);
    expect(archivedBody.status).toBe('ARCHIVED');
    expect(archivedBody.archivedById).toEqual(expect.any(String));
    expect(archivedBody.archivedAt).toEqual(expect.any(String));

    await request(server)
      .get(`${endpoint}/${documentId}/content`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(410);
    const activeAfterArchive = await request(server)
      .get(endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const activeAfterArchiveBody = activeAfterArchive.body as {
      data: unknown[];
    };
    expect(activeAfterArchiveBody.data).toEqual([]);

    const archivedList = await request(server)
      .get(`${endpoint}?includeArchived=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const archivedListBody = archivedList.body as {
      data: Array<{ id: string; status: string }>;
    };
    expect(archivedListBody.data).toContainEqual(
      expect.objectContaining({ id: documentId, status: 'ARCHIVED' }),
    );

    await request(server)
      .post(endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('documentType', PatientDocumentType.PRESCRIPTION)
      .field('treatmentId', treatment.id)
      .attach('file', content, {
        filename: 'informe.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
  });
});
