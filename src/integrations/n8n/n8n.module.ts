import { Module } from '@nestjs/common';
import { N8nWebhookService } from './n8n-webhook.service';
import { N8nTransactionalDispatchService } from './transactional-dispatch.service';
import { N8nWebhookListener } from './n8n-webhook.listener';

@Module({
  providers: [
    N8nWebhookService,
    N8nTransactionalDispatchService,
    N8nWebhookListener,
  ],
  exports: [N8nWebhookService, N8nTransactionalDispatchService],
})
export class N8nModule {}
