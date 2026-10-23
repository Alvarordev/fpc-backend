import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import {
  PATIENT_DATA_CHANGED,
  PatientDataChangedEvent,
} from './patient-data-changed.event';

const DIRTY_PATIENTS_KEY = 'patient-summary-dirty-patients';

type TransactionalQueryRunner = QueryRunner & { transactionDepth: number };
type TransactionEvent = { queryRunner: QueryRunner };

@Injectable()
export class PatientSummaryInvalidationService
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

  async markDirty(patientId: string, manager?: EntityManager): Promise<void> {
    const runner = manager?.queryRunner as TransactionalQueryRunner | undefined;
    if (runner?.isTransactionActive) {
      this.dirtyAt(runner, runner.transactionDepth).add(patientId);
      return;
    }
    await this.events.emitAsync(
      PATIENT_DATA_CHANGED,
      new PatientDataChangedEvent(patientId),
    );
  }

  private afterCommit(
    runner: TransactionalQueryRunner,
  ): Promise<unknown> | undefined {
    const committedDepth = runner.transactionDepth + 1;
    const dirty = this.takeDirtyAt(runner, committedDepth);
    if (!dirty?.size) return;

    // Nested TypeORM transactions commit a savepoint, not the database transaction.
    if (runner.transactionDepth > 0) {
      const parent = this.dirtyAt(runner, runner.transactionDepth);
      for (const patientId of dirty) parent.add(patientId);
      return;
    }
    return Promise.all(
      [...dirty].map((patientId) =>
        this.events.emitAsync(
          PATIENT_DATA_CHANGED,
          new PatientDataChangedEvent(patientId),
        ),
      ),
    );
  }

  private afterRollback(runner: TransactionalQueryRunner): void {
    this.takeDirtyAt(runner, runner.transactionDepth + 1);
  }

  private dirtyAt(runner: QueryRunner, depth: number): Set<string> {
    const all = this.allDirty(runner);
    let dirty = all.get(depth);
    if (!dirty) {
      dirty = new Set<string>();
      all.set(depth, dirty);
    }
    return dirty;
  }

  private takeDirtyAt(
    runner: QueryRunner,
    depth: number,
  ): Set<string> | undefined {
    const all = this.allDirty(runner);
    const dirty = all.get(depth);
    all.delete(depth);
    return dirty;
  }

  private allDirty(runner: QueryRunner): Map<number, Set<string>> {
    const data = runner.data as Record<string, unknown>;
    let dirty = data[DIRTY_PATIENTS_KEY] as
      Map<number, Set<string>> | undefined;
    if (!dirty) {
      dirty = new Map<number, Set<string>>();
      data[DIRTY_PATIENTS_KEY] = dirty;
    }
    return dirty;
  }
}
