import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PatientSummaryStatus } from '../database/entities/patient-summary.entity';
import { GeminiSummaryClient } from './gemini-summary.client';
import {
  PatientSummaryError,
  PatientSummaryErrorCode,
  normalizePatientSummaryError,
} from './patient-summary-error';
import { PatientSummaryPayloadService } from './patient-summary-payload.service';
import { PatientSummaryRateLimiterService } from './patient-summary-rate-limiter.service';
import { PatientSummaryStateService } from './patient-summary-state.service';

interface ClaimedSummary {
  id: string;
  patient_id: string;
  attempt_count: number;
}

@Injectable()
export class PatientSummaryWorkerService {
  private readonly logger = new Logger(PatientSummaryWorkerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly payloads: PatientSummaryPayloadService,
    private readonly gemini: GeminiSummaryClient,
    private readonly limiter: PatientSummaryRateLimiterService,
    private readonly states: PatientSummaryStateService,
  ) {}

  async processBatch(): Promise<void> {
    const timeoutMs =
      this.config.getOrThrow<number>(
        'PATIENT_SUMMARY_PROCESSING_TIMEOUT_SECONDS',
      ) * 1000;
    await this.states.recoverTimedOut(timeoutMs);

    const jobs = await this.claimBatch(
      this.config.getOrThrow<number>('PATIENT_SUMMARY_BATCH_SIZE'),
    );
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      const acquired = await this.limiter.tryAcquire();
      if (!acquired) {
        await this.requeueUnprocessed(jobs.slice(index));
        return;
      }
      await this.process(job);
    }
  }

  async claimBatch(limit: number): Promise<ClaimedSummary[]> {
    return this.dataSource.transaction(async (manager) => {
      const jobs = await manager.query<ClaimedSummary[]>(
        `SELECT "id", "patient_id", "attempt_count"
         FROM "patient_summaries"
         WHERE "status" = $1 AND "available_at" <= now()
         ORDER BY "available_at", "created_at"
         FOR UPDATE SKIP LOCKED
         LIMIT $2`,
        [PatientSummaryStatus.PENDING, limit],
      );
      if (jobs.length === 0) return jobs;

      const ids = jobs.map((job) => job.id);
      await manager.query(
        `UPDATE "patient_summaries"
         SET "status" = $1, "processing_started_at" = now(),
             "attempt_count" = "attempt_count" + 1, "updated_at" = now()
         WHERE "id" = ANY($2::uuid[])`,
        [PatientSummaryStatus.PROCESSING, ids],
      );
      return jobs.map((job) => ({
        ...job,
        attempt_count: Number(job.attempt_count) + 1,
      }));
    });
  }

  private async process(job: ClaimedSummary): Promise<void> {
    try {
      const prompt = await this.payloads.buildPrompt(job.patient_id);
      const generated = await this.gemini.generate(prompt);
      await this.states.markReady(job.id, generated);
    } catch (error) {
      const normalized = this.normalizeJobError(error);
      const maxAttempts = this.config.getOrThrow<number>(
        'PATIENT_SUMMARY_MAX_ATTEMPTS',
      );
      if (normalized.retryable && job.attempt_count < maxAttempts) {
        await this.states.requeue(
          job.id,
          normalized.code,
          normalized.message,
          new Date(Date.now() + retryDelayMs(job.attempt_count)),
        );
        return;
      }
      await this.states.markFailed(job.id, normalized.code, normalized.message);
      this.logger.warn({
        summaryId: job.id,
        code: normalized.code,
        message: 'Patient summary generation failed',
      });
    }
  }

  private normalizeJobError(error: unknown): PatientSummaryError {
    if (error instanceof PatientSummaryError) return error;
    if (error instanceof Error && error.name === 'NotFoundException')
      return new PatientSummaryError(
        PatientSummaryErrorCode.SOURCE_NOT_FOUND,
        false,
        'The patient record no longer exists',
      );
    return normalizePatientSummaryError(error);
  }

  private async requeueUnprocessed(jobs: ClaimedSummary[]): Promise<void> {
    await Promise.all(
      jobs.map((job) =>
        this.states.requeue(
          job.id,
          PatientSummaryErrorCode.RATE_LIMITED,
          'The summary provider quota is exhausted for this window',
          new Date(Date.now() + 60_000),
        ),
      ),
    );
  }
}

function retryDelayMs(attempt: number): number {
  return Math.min(60_000 * 2 ** (attempt - 1), 15 * 60_000);
}
