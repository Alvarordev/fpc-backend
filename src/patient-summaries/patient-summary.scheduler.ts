import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PatientSummaryWorkerService } from './patient-summary-worker.service';

@Injectable()
export class PatientSummaryScheduler {
  constructor(private readonly worker: PatientSummaryWorkerService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingSummaries(): Promise<void> {
    await this.worker.processBatch();
  }
}
