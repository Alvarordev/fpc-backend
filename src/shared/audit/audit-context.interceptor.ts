import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { User } from '../../database/entities/user.entity';
import {
  AUDIT_CONTEXT_KEY,
  AUDIT_FOLLOW_UP_PARAM_KEY,
  AuditContextKind,
  auditStorage,
} from './audit-context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: User }>();
    const targets = [context.getHandler(), context.getClass()];
    const kind = this.reflector.getAllAndOverride<AuditContextKind | undefined>(
      AUDIT_CONTEXT_KEY,
      targets,
    );
    const followUpParam = this.reflector.getAllAndOverride<string | undefined>(
      AUDIT_FOLLOW_UP_PARAM_KEY,
      targets,
    );
    const body = request.body as { followUpId?: unknown } | undefined;
    const candidate = followUpParam
      ? request.params?.[followUpParam]
      : body?.followUpId;
    const followUpId =
      typeof candidate === 'string' && UUID.test(candidate) ? candidate : null;

    const store = {
      actorUserId: request.user?.id ?? null,
      context: kind,
      followUpId,
    };
    return new Observable((subscriber) =>
      auditStorage.run(store, () => next.handle().subscribe(subscriber)),
    );
  }
}
