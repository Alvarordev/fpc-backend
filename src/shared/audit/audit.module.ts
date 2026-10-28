import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditContextInterceptor } from './audit-context.interceptor';
import { AuditContextService } from './audit-context.service';
import { AuditTransactionSubscriber } from './audit-transaction.subscriber';

@Global()
@Module({
  providers: [
    AuditContextService,
    AuditTransactionSubscriber,
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
  ],
  exports: [AuditContextService],
})
export class AuditModule {}
