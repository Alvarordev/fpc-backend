import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user: User = {
    id: 'user-id',
    email: 'agent@example.com',
    passwordHash: '',
    role: UserRole.AGENT,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail'>>;
  let authService: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
    };
    authService = new AuthService(
      usersService as unknown as UsersService,
      { signAsync: jest.fn() } as unknown as JwtService,
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
      {} as DataSource,
      {} as Repository<RefreshToken>,
    );
  });

  it('returns the user when the password is correct', async () => {
    user.passwordHash = await bcrypt.hash('correct-password', 4);
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      authService.validateUser(user.email, 'correct-password'),
    ).resolves.toBe(user);
  });

  it('returns null when the password is incorrect', async () => {
    user.passwordHash = await bcrypt.hash('correct-password', 4);
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      authService.validateUser(user.email, 'incorrect-password'),
    ).resolves.toBeNull();
  });

  it('returns null when the user does not exist', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      authService.validateUser('missing@example.com', 'password'),
    ).resolves.toBeNull();
  });

  it('returns null when the user is inactive', async () => {
    user.isActive = false;
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      authService.validateUser(user.email, 'correct-password'),
    ).resolves.toBeNull();
  });
});
