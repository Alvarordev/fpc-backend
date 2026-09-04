import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/database/entities/user-role.enum';
import { User } from '../src/database/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';

describe('Users update (e2e)', () => {
  const password = 'e2e-password';
  let app: INestApplication;
  let httpServer: Server;
  let usersService: UsersService;
  let jwtService: JwtService;
  let dataSource: DataSource;

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
    const server: unknown = app.getHttpServer();
    httpServer = server as Server;
    usersService = app.get(UsersService);
    jwtService = app.get(JwtService);
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource
      .getRepository(User)
      .createQueryBuilder()
      .delete()
      .where('email LIKE :emailPrefix', {
        emailPrefix: 'e2e-upd-%@example.test',
      })
      .execute();
  });

  afterAll(async () => {
    await app.close();
  });

  async function adminToken(): Promise<string> {
    const admin = await usersService.create({
      email: 'e2e-upd-admin@example.test',
      password,
      role: UserRole.ADMIN,
    });
    return jwtService.signAsync({ sub: admin.id, role: admin.role });
  }

  it('updates email and password for a non-admin user', async () => {
    const token = await adminToken();
    const agent = await usersService.create({
      email: 'e2e-upd-agent@example.test',
      password,
      role: UserRole.AGENT,
    });

    const updated = await request(httpServer)
      .patch(`/users/${agent.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'e2e-upd-agent-new@example.test',
        password: 'new-password',
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: agent.id,
      email: 'e2e-upd-agent-new@example.test',
      role: UserRole.AGENT,
      isActive: true,
    });

    await request(httpServer)
      .post('/auth/login')
      .send({ email: 'e2e-upd-agent@example.test', password })
      .expect(401);

    await request(httpServer)
      .post('/auth/login')
      .send({
        email: 'e2e-upd-agent-new@example.test',
        password: 'new-password',
      })
      .expect(201);
  });

  it('rejects updating an administrator', async () => {
    const token = await adminToken();
    const otherAdmin = await usersService.create({
      email: 'e2e-upd-admin-2@example.test',
      password,
      role: UserRole.ADMIN,
    });

    await request(httpServer)
      .patch(`/users/${otherAdmin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'e2e-upd-admin-renamed@example.test' })
      .expect(403);
  });

  it('deactivates a user so login fails and can reactivate', async () => {
    const token = await adminToken();
    const agent = await usersService.create({
      email: 'e2e-upd-deactivate@example.test',
      password,
      role: UserRole.AGENT,
    });

    await request(httpServer)
      .patch(`/users/${agent.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);

    await request(httpServer)
      .post('/auth/login')
      .send({ email: 'e2e-upd-deactivate@example.test', password })
      .expect(401);

    await request(httpServer)
      .patch(`/users/${agent.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true })
      .expect(200);

    await request(httpServer)
      .post('/auth/login')
      .send({ email: 'e2e-upd-deactivate@example.test', password })
      .expect(201);
  });
});
