import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import request from 'supertest';
import type { Response } from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RefreshToken } from '../src/database/entities/refresh-token.entity';
import { UserRole } from '../src/database/entities/user-role.enum';
import { User } from '../src/database/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';

describe('Authentication (e2e)', () => {
  const password = 'e2e-password';
  let app: INestApplication;
  let httpServer: Server;
  let usersService: UsersService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
    const server: unknown = app.getHttpServer();
    httpServer = server as Server;
    usersService = app.get(UsersService);
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    const dataSource = app.get(DataSource);
    await dataSource
      .getRepository(RefreshToken)
      .createQueryBuilder()
      .delete()
      .where(
        'user_id IN (SELECT id FROM users WHERE email LIKE :emailPrefix)',
        { emailPrefix: 'e2e-%@example.test' },
      )
      .execute();
    await dataSource
      .getRepository(User)
      .createQueryBuilder()
      .delete()
      .where('email LIKE :emailPrefix', { emailPrefix: 'e2e-%@example.test' })
      .execute();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in only active users and sets an httpOnly refresh cookie', async () => {
    await usersService.create({
      email: 'e2e-login@example.test',
      password,
      role: UserRole.ADMIN,
    });
    const activeLogin = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'e2e-login@example.test', password })
      .expect(201);
    const activeLoginBody = activeLogin.body as unknown as LoginResponseBody;

    expect(activeLoginBody.accessToken).toEqual(expect.any(String));
    expect(activeLoginBody.user).toMatchObject({
      email: 'e2e-login@example.test',
      role: UserRole.ADMIN,
    });
    expect(refreshCookie(activeLogin)).toContain('HttpOnly');
    expect(refreshCookie(activeLogin)).toContain('Path=/auth');

    await request(httpServer)
      .post('/auth/login')
      .send({ email: 'e2e-login@example.test', password: 'incorrect' })
      .expect(401);

    const inactiveUser = await usersService.create({
      email: 'e2e-inactive@example.test',
      password,
      role: UserRole.AGENT,
    });
    await usersService.setActive(inactiveUser.id, false);
    await request(httpServer)
      .post('/auth/login')
      .send({ email: 'e2e-inactive@example.test', password })
      .expect(401);
  });

  it('rotates valid refresh cookies and rejects missing or revoked cookies', async () => {
    await usersService.create({
      email: 'e2e-refresh@example.test',
      password,
      role: UserRole.AGENT,
    });
    const login = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'e2e-refresh@example.test', password })
      .expect(201);
    const oldCookie = refreshCookie(login).split(';')[0];

    const refresh = await request(httpServer)
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(201);
    const refreshBody = refresh.body as unknown as RefreshResponseBody;
    expect(refreshBody.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(refresh)).not.toBe(refreshCookie(login));

    await request(httpServer).post('/auth/refresh').expect(401);
    await request(httpServer)
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(401);
  });

  it('revokes the current refresh token on logout', async () => {
    await usersService.create({
      email: 'e2e-logout@example.test',
      password,
      role: UserRole.AGENT,
    });
    const login = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'e2e-logout@example.test', password })
      .expect(201);
    const currentRefreshCookie = refreshCookie(login).split(';')[0];
    const loginBody = login.body as unknown as LoginResponseBody;

    await request(httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${loginBody.accessToken}`)
      .set('Cookie', currentRefreshCookie)
      .expect(204);
    await request(httpServer)
      .post('/auth/refresh')
      .set('Cookie', currentRefreshCookie)
      .expect(401);
  });

  it('protects endpoints and enforces the ADMIN role when creating users', async () => {
    await request(httpServer).get('/users/me').expect(401);

    const agent = await usersService.create({
      email: 'e2e-agent@example.test',
      password,
      role: UserRole.AGENT,
    });
    const agentAccessToken = await jwtService.signAsync({
      sub: agent.id,
      role: agent.role,
    });

    await request(httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${agentAccessToken}`)
      .send({
        email: 'e2e-created@example.test',
        password,
        role: UserRole.VOLUNTEER,
      })
      .expect(403);
  });
});

interface LoginResponseBody {
  accessToken: string;
  user: {
    email: string;
    role: UserRole;
  };
}

interface RefreshResponseBody {
  accessToken: string;
}

function refreshCookie(response: Response): string {
  const cookie = response.headers['set-cookie']?.[0];

  if (!cookie) {
    throw new Error('Expected a refresh cookie');
  }

  return cookie;
}
