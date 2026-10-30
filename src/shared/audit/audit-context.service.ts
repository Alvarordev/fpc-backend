import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AuditContextKind,
  auditSettingFor,
  auditStorage,
} from './audit-context';

@Injectable()
export class AuditContextService {
  /**
   * Ties the rest of the current transaction to a follow-up, e.g. once an
   * enrollment has created its follow-up. Rows already written in the same
   * transaction (the new patient, its details) are re-stamped too, so the
   * whole enrollment reads as one follow-up.
   */
  async attachFollowUp(
    manager: EntityManager,
    followUpId: string,
    context: AuditContextKind = AuditContextKind.FOLLOW_UP,
  ) {
    const store = auditStorage.getStore();
    if (store) {
      store.followUpId = followUpId;
      store.context = context;
    }
    await manager.query(
      `SELECT set_config(
         'app.audit',
         (COALESCE(NULLIF(current_setting('app.audit', true), '')::jsonb, '{}'::jsonb)
           || jsonb_build_object('followUpId', $1::text, 'context', $2::text))::text,
         true
       )`,
      [followUpId, context],
    );
    await manager.query(
      `UPDATE change_log
          SET follow_up_id = $1, context = $2
        WHERE change_set_id = (current_setting('app.audit', true)::jsonb ->> 'changeSetId')::uuid`,
      [followUpId, context],
    );
  }

  /** Runs work outside a request (jobs, scripts) with an explicit context. */
  run<T>(
    store: { actorUserId: string | null; context: AuditContextKind },
    fn: () => T,
  ): T {
    return auditStorage.run({ ...store }, fn);
  }

  current() {
    return auditSettingFor(auditStorage.getStore());
  }
}
