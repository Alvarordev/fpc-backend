import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 10000;

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export type EmailSendResult =
  | { status: 'SENT'; id: string | null }
  | { status: 'DISABLED' }
  | { status: 'FAILED'; error: string };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.apiKey = (config.get<string>('RESEND_API_KEY') ?? '').trim();
    this.from = (config.get<string>('EMAIL_FROM') ?? '').trim();
  }

  get enabled(): boolean {
    return Boolean(this.apiKey && this.from);
  }

  // Never throws: callers decide what a FAILED or DISABLED result means.
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const to = (Array.isArray(message.to) ? message.to : [message.to])
      .map((address) => address.trim())
      .filter(Boolean);
    if (to.length === 0)
      return { status: 'FAILED', error: 'No hay destinatario para el correo.' };

    if (!this.enabled) {
      this.logger.log({
        message: 'RESEND_API_KEY or EMAIL_FROM is not configured, skipping',
        to,
        subject: message.subject,
      });
      return { status: 'DISABLED' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to,
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn({
          message: `Resend returned ${response.status}`,
          subject: message.subject,
        });
        return {
          status: 'FAILED',
          error:
            'El proveedor de correo rechazó el envío. Revisa la dirección del paciente o intenta más tarde.',
        };
      }
      const body = (await response.json().catch(() => null)) as {
        id?: string;
      } | null;
      return { status: 'SENT', id: body?.id ?? null };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn({ message: reason, subject: message.subject });
      return {
        status: 'FAILED',
        error:
          'No se pudo conectar con el proveedor de correo. Intenta más tarde.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
