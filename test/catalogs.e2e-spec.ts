import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CatalogItem } from '../src/database/entities/catalog-item.entity';
import { UbigeoDepartment } from '../src/database/entities/ubigeo.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import { User } from '../src/database/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';

describe('Catalogs (e2e)', () => {
  const password = 'e2e-password';
  let app: INestApplication;
  let httpServer: Server;
  let usersService: UsersService;
  let dataSource: DataSource;
  let adminToken: string;

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
    httpServer = app.getHttpServer() as Server;
    usersService = app.get(UsersService);
    dataSource = app.get(DataSource);

    await usersService.create({
      email: 'e2e-catalogs-admin@example.test',
      password,
      role: UserRole.ADMIN,
    });

    const login = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'e2e-catalogs-admin@example.test', password })
      .expect(201);

    adminToken = (login.body as { accessToken: string }).accessToken;

    await dataSource.getRepository(CatalogItem).save(
      dataSource.getRepository(CatalogItem).create({
        kind: 'cancer_stage',
        code: 'STAGE_1',
        label: 'Estadio I',
        sortOrder: 10,
        isActive: true,
        isSystem: true,
      }),
    );

    await dataSource.getRepository(UbigeoDepartment).save(
      dataSource.getRepository(UbigeoDepartment).create({
        code: 'LIMA',
        ineiCode: '15',
        name: 'Lima',
        sortOrder: 15,
        isActive: true,
      }),
    );
  });

  afterAll(async () => {
    await dataSource.getRepository(CatalogItem).delete({ code: 'STAGE_1' });
    await dataSource.getRepository(CatalogItem).delete({ code: 'E2E_LANG' });
    await dataSource.getRepository(UbigeoDepartment).delete({ code: 'LIMA' });
    await dataSource
      .getRepository(User)
      .delete({ email: 'e2e-catalogs-admin@example.test' });
    await app.close();
  });

  it('lists catalog items by kind', async () => {
    const response = await request(httpServer)
      .get('/catalogs')
      .query({ kind: 'cancer_stage' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = response.body as Array<{ code: string; label: string }>;
    expect(body.some((item) => item.code === 'STAGE_1')).toBe(true);
  });

  it('returns ubigeo departments', async () => {
    const response = await request(httpServer)
      .get('/catalogs/ubigeo')
      .query({ department: 'LIMA' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = response.body as {
      departments: Array<{ code: string; name: string }>;
    };
    expect(body.departments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'LIMA', name: 'Lima' }),
      ]),
    );
  });

  it('allows admin to create and archive a non-system item', async () => {
    const created = await request(httpServer)
      .post('/catalogs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        kind: 'native_language',
        code: 'E2E_LANG',
        label: 'Lengua e2e',
      })
      .expect(201);

    const createdBody = created.body as { id: string; isActive: boolean };
    expect(createdBody.isActive).toBe(true);

    const archived = await request(httpServer)
      .post(`/catalogs/${createdBody.id}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect((archived.body as { isActive: boolean }).isActive).toBe(false);
  });

  it('rejects archiving system items', async () => {
    const listed = await request(httpServer)
      .get('/catalogs')
      .query({ kind: 'cancer_stage', includeInactive: true })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const stage = (listed.body as Array<{ id: string; code: string }>).find(
      (item) => item.code === 'STAGE_1',
    );
    expect(stage).toBeDefined();

    await request(httpServer)
      .post(`/catalogs/${stage!.id}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
