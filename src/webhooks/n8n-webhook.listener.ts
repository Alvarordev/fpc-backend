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
  handle(event: N8nWebhookDispatchEvent): void {
    this.service.dispatch(event.envelope);
  }
}
