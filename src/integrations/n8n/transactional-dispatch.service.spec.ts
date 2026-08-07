import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { N8nTransactionalDispatchService } from './transactional-dispatch.service';
import {
  N8N_WEBHOOK_EVENT,
  N8nWebhookDispatchEvent,
  N8nWebhookEnvelope,
} from './n8n-webhook.events';

function envelope(id: string): N8nWebhookEnvelope {
  return { var: 'Registro', query: { nombre: id } };
}

// Mirrors real TypeORM QueryRunner semantics: transactionDepth is
// incremented to N *before* work runs inside the transaction, then
// decremented to N-1 *before* the afterTransactionCommit/Rollback event
// fires on that same runner object (see PostgresQueryRunner.commitTransaction).
function fakeRunner(startDepth: number) {
  return {
    isTransactionActive: true,
    transactionDepth: startDepth,
    data: {},
  } as unknown as QueryRunner & { transactionDepth: number };
}

describe('N8nTransactionalDispatchService', () => {
  function build() {
    const emitAsync = jest.fn().mockResolvedValue(undefined);
    const events = { emitAsync } as unknown as EventEmitter2;
    const subscribers: unknown[] = [];
    const dataSource = { subscribers } as unknown as DataSource;
    const service = new N8nTransactionalDispatchService(dataSource, events);
    service.onModuleInit();
    const subscriber = subscribers[0] as {
      afterTransactionCommit: (e: { queryRunner: QueryRunner }) => unknown;
      afterTransactionRollback: (e: { queryRunner: QueryRunner }) => unknown;
    };
    return { service, emitAsync, subscriber };
  }

  it('dispatches immediately when called with no manager', async () => {
    const { service, emitAsync } = build();

    await service.enqueue(envelope('a'));

    expect(emitAsync).toHaveBeenCalledWith(
      N8N_WEBHOOK_EVENT,
      new N8nWebhookDispatchEvent(envelope('a')),
    );
  });

  it('defers dispatch until after commit when inside a transaction', async () => {
    const { service, emitAsync, subscriber } = build();
    const runner = fakeRunner(1); // inside the outermost transaction

    await service.enqueue(envelope('a'), {
      queryRunner: runner,
    } as unknown as EntityManager);
    expect(emitAsync).not.toHaveBeenCalled();

    runner.transactionDepth = 0; // commitTransaction() decrements before broadcasting
    await subscriber.afterTransactionCommit({ queryRunner: runner });

    expect(emitAsync).toHaveBeenCalledWith(
      N8N_WEBHOOK_EVENT,
      new N8nWebhookDispatchEvent(envelope('a')),
    );
  });

  it('discards queued envelopes on rollback and dispatches nothing on a later commit', async () => {
    const { service, emitAsync, subscriber } = build();
    const runner = fakeRunner(1);

    await service.enqueue(envelope('a'), {
      queryRunner: runner,
    } as unknown as EntityManager);
    runner.transactionDepth = 0;
    subscriber.afterTransactionRollback({ queryRunner: runner });
    await subscriber.afterTransactionCommit({ queryRunner: runner });

    expect(emitAsync).not.toHaveBeenCalled();
  });

  it('merges nested-transaction envelopes into the parent depth instead of dispatching on savepoint commit', async () => {
    const { service, emitAsync, subscriber } = build();
    const runner = fakeRunner(2); // inside a nested (savepoint) transaction

    await service.enqueue(envelope('nested'), {
      queryRunner: runner,
    } as unknown as EntityManager);

    runner.transactionDepth = 1; // savepoint release: depth 2 -> 1
    await subscriber.afterTransactionCommit({ queryRunner: runner });
    expect(emitAsync).not.toHaveBeenCalled(); // merged into parent, not dispatched

    runner.transactionDepth = 0; // outer commit: depth 1 -> 0
    await subscriber.afterTransactionCommit({ queryRunner: runner });
    expect(emitAsync).toHaveBeenCalledWith(
      N8N_WEBHOOK_EVENT,
      new N8nWebhookDispatchEvent(envelope('nested')),
    );
  });
});
