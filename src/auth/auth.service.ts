import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { CookieOptions } from 'express';
import ms from 'ms';
import { DataSource, IsNull, Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { UsersService } from '../users/users.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: User['role'];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    return passwordMatches ? user : null;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = await this.createRefreshToken(
      user,
      this.refreshTokensRepository,
    );

    return {
      accessToken: await this.createAccessToken(user),
      refreshToken: refreshToken.value,
      user: this.toAuthenticatedUser(user),
    };
  }

  async refresh(tokenValue: string): Promise<RefreshResult> {
    const tokenHash = this.hashToken(tokenValue);

    const result = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshToken);
      const currentToken = await repository.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (!currentToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (currentToken.replacedById) {
        await repository.update(
          { userId: currentToken.userId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        return null;
      }

      const user = await manager.getRepository(User).findOne({
        where: { id: currentToken.userId },
      });

      if (
        currentToken.revokedAt ||
        currentToken.expiresAt <= new Date() ||
        !user ||
        !user.isActive
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const nextToken = await this.createRefreshToken(user, repository);
      currentToken.revokedAt = new Date();
      currentToken.replacedById = nextToken.id;
      await repository.save(currentToken);

      return {
        accessToken: await this.createAccessToken(user),
        refreshToken: nextToken.value,
      };
    });

    if (!result) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return result;
  }

  async logout(userId: string, tokenValue?: string): Promise<void> {
    if (!tokenValue) {
      return;
    }

    const token = await this.refreshTokensRepository.findOne({
      where: { tokenHash: this.hashToken(tokenValue), userId },
    });

    if (token && !token.revokedAt) {
      token.revokedAt = new Date();
      await this.refreshTokensRepository.save(token);
    }
  }

  getRefreshCookieName(): string {
    return this.configService.getOrThrow<string>('REFRESH_TOKEN_COOKIE_NAME');
  }

  getRefreshCookieOptions(): CookieOptions {
    const isProduction =
      this.configService.getOrThrow<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/auth',
      maxAge: this.refreshTokenMaxAge(),
    };
  }

  private async createAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, role: user.role });
  }

  private async createRefreshToken(
    user: User,
    repository: Repository<RefreshToken>,
  ): Promise<{ id: string; value: string }> {
    const value = randomBytes(32).toString('base64url');
    const token = repository.create({
      userId: user.id,
      tokenHash: this.hashToken(value),
      expiresAt: new Date(Date.now() + this.refreshTokenMaxAge()),
      revokedAt: null,
      replacedById: null,
    });
    const savedToken = await repository.save(token);

    return { id: savedToken.id, value };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTokenMaxAge(): number {
    const duration = ms(
      this.configService.getOrThrow<ms.StringValue>('REFRESH_TOKEN_EXPIRES_IN'),
    );

    if (typeof duration !== 'number' || duration <= 0) {
      throw new Error('REFRESH_TOKEN_EXPIRES_IN must be a positive duration');
    }

    return duration;
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
