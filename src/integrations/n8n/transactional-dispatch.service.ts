import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import {
  N8N_WEBHOOK_EVENT,
  N8nWebhookDispatchEvent,
  N8nWebhookEnvelope,
} from './n8n-webhook.events';

// Deliberately a second, independent copy of the after-commit subscriber
// pattern in src/patient-summaries/patient-summary-invalidation.service.ts
// (own key on runner.data, own savepoint-aware depth map). That service is
// load-bearing for summaries and has no unit spec of its own; generalizing
// it into a shared abstraction is a real refactor that belongs in its own
// PR once a third consumer shows up, not bundled into this feature.
const PENDING_WEBHOOKS_KEY = 'n8n-pending-webhooks';

type TransactionalQueryRunner = QueryRunner & { transactionDepth: number };
type TransactionEvent = { queryRunner: QueryRunner };

@Injectable()
export class N8nTransactionalDispatchService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly subscriber = {
    afterTransactionCommit: (event: TransactionEvent) =>
      this.afterCommit(event.queryRunner as TransactionalQueryRunner),
    afterTransactionRollback: (event: TransactionEvent) =>
      this.afterRollback(event.queryRunner as TransactionalQueryRunner),
  };

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.dataSource.subscribers.push(this.subscriber);
  }

  onModuleDestroy(): void {
    const index = this.dataSource.subscribers.indexOf(this.subscriber);
    if (index >= 0) this.dataSource.subscribers.splice(index, 1);
  }

  // `envelope` must already be a flat, plain-string payload — snapshot the
  // data (patient name, DNI, phone, ...) inside the caller's transaction
  // before calling this, never pass entity references. After commit the
  // EntityManager that produced them is gone.
  async enqueue(
    envelope: N8nWebhookEnvelope,
    manager?: EntityManager,
  ): Promise<void> {
    const runner = manager?.queryRunner as TransactionalQueryRunner | undefined;
    if (runner?.isTransactionActive) {
      this.pendingAt(runner, runner.transactionDepth).push(envelope);
      return;
    }
    await this.events.emitAsync(
      N8N_WEBHOOK_EVENT,
      new N8nWebhookDispatchEvent(envelope),
    );
  }

  private afterCommit(
    runner: TransactionalQueryRunner,
  ): Promise<unknown> | undefined {
    const committedDepth = runner.transactionDepth + 1;
    const pending = this.takePendingAt(runner, committedDepth);
    if (!pending?.length) return;

    // Nested TypeORM transactions commit a savepoint, not the database
    // transaction — merge into the parent depth instead of dispatching.
    if (runner.transactionDepth > 0) {
      const parent = this.pendingAt(runner, runner.transactionDepth);
      parent.push(...pending);
      return;
    }
    return Promise.all(
      pending.map((envelope) =>
        this.events.emitAsync(
          N8N_WEBHOOK_EVENT,
          new N8nWebhookDispatchEvent(envelope),
        ),
      ),
    );
  }

  private afterRollback(runner: TransactionalQueryRunner): void {
    this.takePendingAt(runner, runner.transactionDepth + 1);
  }

  private pendingAt(runner: QueryRunner, depth: number): N8nWebhookEnvelope[] {
    const all = this.allPending(runner);
    let list = all.get(depth);
    if (!list) {
      list = [];
      all.set(depth, list);
    }
    return list;
  }

  private takePendingAt(
    runner: QueryRunner,
    depth: number,
  ): N8nWebhookEnvelope[] | undefined {
    const all = this.allPending(runner);
    const list = all.get(depth);
    all.delete(depth);
    return list;
  }

  private allPending(runner: QueryRunner): Map<number, N8nWebhookEnvelope[]> {
    const data = runner.data as Record<string, unknown>;
    let pending = data[PENDING_WEBHOOKS_KEY] as
      Map<number, N8nWebhookEnvelope[]> | undefined;
    if (!pending) {
      pending = new Map<number, N8nWebhookEnvelope[]>();
      data[PENDING_WEBHOOKS_KEY] = pending;
    }
    return pending;
  }
}
