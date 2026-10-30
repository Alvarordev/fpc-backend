import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { EmailService } from '../../integrations/email/email.service';
import { UsersService } from '../users/users.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const INVALID_LINK =
  'El enlace no es válido o ya venció. Solicita uno nuevo desde «¿Olvidaste tu contraseña?».';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(PasswordResetToken)
    private readonly tokens: Repository<PasswordResetToken>,
  ) {}

  // Responde igual exista o no el correo, para no revelar qué cuentas existen.
  async requestReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(
      email.trim().toLowerCase(),
    );
    if (!user || !user.isActive) return;

    await this.tokens.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const value = randomBytes(32).toString('base64url');
    await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        tokenHash: this.hash(value),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        usedAt: null,
      }),
    );

    const link = `${this.frontendUrl()}/restablecer-contrasena?token=${value}`;
    const result = await this.email.send({
      to: user.email,
      subject: 'Restablece tu contraseña del CRM SEPA',
      text: [
        'Hola,',
        '',
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta en el CRM SEPA.',
        'Para elegir una nueva contraseña, abre este enlace (vence en 1 hora):',
        '',
        link,
        '',
        'Si no lo pediste, ignora este correo: tu contraseña no cambiará.',
        '',
        'Fundación Peruana de Cáncer',
      ].join('\n'),
      html: resetEmailHtml(link),
    });
    if (result.status !== 'SENT') {
      this.logger.warn({
        message: 'Password reset email not sent',
        status: result.status,
      });
      // Sin proveedor de correo en desarrollo, el enlace queda en el log para probar.
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        this.logger.log(
          `Enlace de restablecimiento (solo desarrollo): ${link}`,
        );
      }
    }
  }

  async verify(value: string): Promise<void> {
    await this.findValidToken(value);
  }

  async reset(value: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 12);
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PasswordResetToken);
      const token = await repository.findOne({
        where: {
          tokenHash: this.hash(value),
          usedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        lock: { mode: 'pessimistic_write' },
      });
      const user = token
        ? await manager
            .getRepository(User)
            .findOne({ where: { id: token.userId } })
        : null;
      if (!token || !user || !user.isActive)
        throw new BadRequestException(INVALID_LINK);

      const now = new Date();
      await manager
        .getRepository(User)
        .update({ id: user.id }, { passwordHash });
      await repository.update(
        { userId: user.id, usedAt: IsNull() },
        { usedAt: now },
      );
      // Cierra las sesiones abiertas: quien tenía la contraseña anterior pierde acceso.
      await manager
        .getRepository(RefreshToken)
        .update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: now });
    });
  }

  private async findValidToken(value: string): Promise<PasswordResetToken> {
    const token = await this.tokens.findOne({
      where: {
        tokenHash: this.hash(value),
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });
    if (!token || !token.user?.isActive)
      throw new BadRequestException(INVALID_LINK);
    return token;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private frontendUrl(): string {
    const configured = this.config.get<string>('FRONTEND_URL')?.trim();
    const fallback = this.config
      .getOrThrow<string>('CORS_ORIGIN')
      .split(',')[0]
      .trim();
    return (configured || fallback).replace(/\/+$/, '');
  }
}

function resetEmailHtml(link: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f6f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <tr><td>
        <h1 style="font-size:20px;margin:0 0 16px">Restablece tu contraseña</h1>
        <p style="font-size:15px;line-height:1.5;margin:0 0 16px">Recibimos una solicitud para restablecer la contraseña de tu cuenta en el CRM SEPA.</p>
        <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#d71920;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Elegir nueva contraseña</a></p>
        <p style="font-size:13px;line-height:1.5;color:#57534e;margin:0 0 8px">El enlace vence en 1 hora y solo se puede usar una vez.</p>
        <p style="font-size:13px;line-height:1.5;color:#57534e;margin:0">Si no lo pediste, ignora este correo: tu contraseña no cambiará.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
