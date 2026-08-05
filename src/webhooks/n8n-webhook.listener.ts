import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  N8N_WEBHOOK_EVENT,
  N8nWebhookDispatchEvent,
} from './n8n-webhook.events';
import { N8nWebhookService } from './n8n-webhook.service';

@Injectable()
export class N8nWebhookListener {
  constructor(private readonly service: N8nWebhookService) {}

  @OnEvent(N8N_WEBHOOK_EVENT)
  async handle(event: N8nWebhookDispatchEvent): Promise<void> {
    await this.service.dispatch(event.envelope);
  }
}
