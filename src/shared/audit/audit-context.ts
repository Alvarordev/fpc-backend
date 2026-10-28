import { AsyncLocalStorage } from 'node:async_hooks';
import { SetMetadata } from '@nestjs/common';

/**
 * Why a change happened. FOLLOW_UP changes belong to a contact with the
 * patient; anything else done from the patient file is an ADMIN_ADJUSTMENT.
 */
export enum AuditContextKind {
  FOLLOW_UP = 'FOLLOW_UP',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',
  HISTORICAL_LOAD = 'HISTORICAL_LOAD',
  SYSTEM = 'SYSTEM',
}

export interface AuditStore {
  actorUserId: string | null;
  context?: AuditContextKind;
  followUpId?: string | null;
}

/**
 * Per-request audit context. The database triggers on patient tables read it
 * (through the `app.audit` setting) to stamp every change_log row.
 */
export const auditStorage = new AsyncLocalStorage<AuditStore>();

export const AUDIT_CONTEXT_KEY = 'auditContext';
export const AUDIT_FOLLOW_UP_PARAM_KEY = 'auditFollowUpParam';

/** Forces the audit context of every route in a controller or handler. */
export const AuditContext = (kind: AuditContextKind) =>
  SetMetadata(AUDIT_CONTEXT_KEY, kind);

/** Takes the follow-up of the change from a route param, e.g. PATCH /follow-ups/:id. */
export const AuditFollowUpParam = (param: string) =>
  SetMetadata(AUDIT_FOLLOW_UP_PARAM_KEY, param);

export function auditSettingFor(store: AuditStore | undefined) {
  const followUpId = store?.followUpId ?? null;
  return {
    actorUserId: store?.actorUserId ?? null,
    context:
      store?.context ??
      (store
        ? followUpId
          ? AuditContextKind.FOLLOW_UP
          : AuditContextKind.ADMIN_ADJUSTMENT
        : AuditContextKind.SYSTEM),
    followUpId,
  };
}
