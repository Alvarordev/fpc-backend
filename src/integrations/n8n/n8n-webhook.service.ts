import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nWebhookEnvelope } from './n8n-webhook.events';

@Injectable()
export class N8nWebhookService {
  private readonly logger = new Logger(N8nWebhookService.name);
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.url = (config.get<string>('N8N_WEBHOOK_URL') ?? '').trim();
    this.timeoutMs = config.getOrThrow<number>('N8N_WEBHOOK_TIMEOUT_MS');
  }

  // Fire-and-forget by design (matches fpc-back's N8nWebhookService): no
  // retries, no outbox, failures are logged and dropped, never throws.
  // Deliberately NOT async/awaited by callers: TypeORM awaits whatever
  // afterTransactionCommit returns (see Broadcaster.js), so awaiting the
  // fetch here would block the caller's HTTP response for up to
  // N8N_WEBHOOK_TIMEOUT_MS on every write that dispatches a webhook.
  dispatch(envelope: N8nWebhookEnvelope): void {
    if (!this.url) {
      this.logger.debug({
        event: envelope.var,
        message: 'N8N_WEBHOOK_URL is not configured, skipping',
      });
      return;
    }
    void this.send(envelope);
  }

  private async send(envelope: N8nWebhookEnvelope): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn({
          event: envelope.var,
          status: response.status,
          message: 'n8n webhook returned a non-2xx status',
        });
      }
    } catch (error) {
      this.logger.warn({
        event: envelope.var,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
