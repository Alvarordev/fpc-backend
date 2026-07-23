import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService refresh tokens', () => {
  const user: User = {
    id: 'user-id',
    email: 'agent@example.com',
    passwordHash: 'hash',
    role: UserRole.AGENT,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let authService: AuthService;
  let tokens: RefreshToken[];

  beforeEach(() => {
    tokens = [];
    let nextId = 1;
    const repository = {
      create: jest.fn((token: Partial<RefreshToken>) => token),
      save: jest.fn((token: RefreshToken) => {
        if (!token.id) {
          token.id = `token-${nextId++}`;
          tokens.push(token);
        } else {
          const existingToken = tokens.find(
            (candidate) => candidate.id === token.id,
          );
          if (existingToken) {
            Object.assign(existingToken, token);
          }
        }
        return token;
      }),
      findOne: jest.fn(({ where }: { where: { tokenHash: string } }) => {
        const token = tokens.find(
          (candidate) => candidate.tokenHash === where.tokenHash,
        );
        return token ? { ...token, user } : null;
      }),
      update: jest.fn(
        (_criteria: unknown, update: Pick<RefreshToken, 'revokedAt'>) => {
          for (const token of tokens) {
            if (!token.revokedAt) {
              token.revokedAt = update.revokedAt;
            }
          }
        },
      ),
    };
    const usersRepository = {
      findOne: jest.fn(() => user),
    };
    const dataSource = {
      transaction: jest.fn(
        (
          callback: (manager: {
            getRepository: (
              entity: unknown,
            ) => typeof repository | typeof usersRepository;
          }) => unknown,
        ) =>
          callback({
            getRepository: (entity: unknown) =>
              entity === RefreshToken ? repository : usersRepository,
          }),
      ),
    };

    authService = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(user),
      } as unknown as UsersService,
      {
        signAsync: jest.fn().mockResolvedValue('access-token'),
      } as unknown as JwtService,
      {
        getOrThrow: jest.fn((key: string) => {
          if (key === 'REFRESH_TOKEN_EXPIRES_IN') {
            return '7d';
          }
          if (key === 'REFRESH_TOKEN_COOKIE_NAME') {
            return 'refresh_token';
          }
          return 'development';
        }),
      } as unknown as ConfigService,
      dataSource as unknown as DataSource,
      repository as unknown as Repository<RefreshToken>,
    );
    jest.spyOn(authService, 'validateUser').mockResolvedValue(user);
  });

  it('issues and rotates a refresh token', async () => {
    const login = await authService.login(user.email, 'password');
    const rotated = await authService.refresh(login.refreshToken);

    expect(login.refreshToken).not.toBe(tokens[0].tokenHash);
    expect(rotated.refreshToken).not.toBe(login.refreshToken);
    expect(tokens).toHaveLength(2);
    expect(tokens[0].revokedAt).not.toBeNull();
    expect(tokens[0].replacedById).toBe(tokens[1].id);
  });

  it('revokes all active sessions when a rotated token is reused', async () => {
    const login = await authService.login(user.email, 'password');
    const rotated = await authService.refresh(login.refreshToken);

    await expect(authService.refresh(login.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(tokens.every((token) => token.revokedAt)).toBe(true);
    await expect(authService.refresh(rotated.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
