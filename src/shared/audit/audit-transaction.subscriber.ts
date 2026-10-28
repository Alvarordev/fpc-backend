import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntitySubscriberInterface,
  TransactionStartEvent,
} from 'typeorm';
import { auditSettingFor, auditStorage } from './audit-context';

/**
 * Hands the request's audit context to Postgres at the start of every
 * transaction. The change_log triggers read it from `app.audit`; writes made
 * outside a transaction are still logged, only without actor (SYSTEM).
 */
@Injectable()
export class AuditTransactionSubscriber implements EntitySubscriberInterface {
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  async afterTransactionStart(event: TransactionStartEvent) {
    const setting = {
      ...auditSettingFor(auditStorage.getStore()),
      changeSetId: randomUUID(),
    };
    await event.queryRunner.query(`SELECT set_config('app.audit', $1, true)`, [
      JSON.stringify(setting),
    ]);
  }
}
