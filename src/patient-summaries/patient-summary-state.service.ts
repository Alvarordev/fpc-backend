import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  PatientSummary,
  PatientSummaryStatus,
} from '../database/entities/patient-summary.entity';

@Injectable()
export class PatientSummaryStateService {
  constructor(
    @InjectRepository(PatientSummary)
    private readonly summaries: Repository<PatientSummary>,
  ) {}

  async markReady(
    id: string,
    result: { text: string; model: string },
  ): Promise<void> {
    await this.summaries.update(
      { id, status: PatientSummaryStatus.PROCESSING },
      {
        status: PatientSummaryStatus.READY,
        summary: result.text,
        model: result.model,
        errorCode: null,
        errorMessage: null,
        processingStartedAt: null,
        completedAt: new Date(),
      },
    );
  }

  async storeReady(
    patientId: string,
    result: { text: string; model: string },
  ): Promise<void> {
    await this.summaries.upsert(
      {
        patientId,
        status: PatientSummaryStatus.READY,
        summary: result.text,
        model: result.model,
        errorCode: null,
        errorMessage: null,
        attemptCount: 0,
        availableAt: new Date(),
        processingStartedAt: null,
        completedAt: new Date(),
      },
      ['patientId'],
    );
  }

  async markPending(patientId: string): Promise<void> {
    await this.summaries.upsert(
      {
        patientId,
        status: PatientSummaryStatus.PENDING,
        errorCode: null,
        errorMessage: null,
        attemptCount: 0,
        availableAt: new Date(),
        processingStartedAt: null,
        completedAt: null,
      },
      ['patientId'],
    );
  }

  async requeue(
    id: string,
    errorCode: string,
    errorMessage: string,
    availableAt: Date,
  ): Promise<void> {
    await this.summaries.update(
      { id, status: PatientSummaryStatus.PROCESSING },
      {
        status: PatientSummaryStatus.PENDING,
        errorCode,
        errorMessage,
        availableAt,
        processingStartedAt: null,
      },
    );
  }

  async markFailed(
    id: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.summaries.update(
      { id, status: PatientSummaryStatus.PROCESSING },
      {
        status: PatientSummaryStatus.FAILED,
        errorCode,
        errorMessage,
        processingStartedAt: null,
      },
    );
  }

  async recoverTimedOut(timeoutMs: number, now = new Date()): Promise<number> {
    const result = await this.summaries.update(
      {
        status: PatientSummaryStatus.PROCESSING,
        processingStartedAt: LessThan(new Date(now.valueOf() - timeoutMs)),
      },
      {
        status: PatientSummaryStatus.PENDING,
        errorCode: null,
        errorMessage: null,
        availableAt: now,
        processingStartedAt: null,
      },
    );
    return result.affected ?? 0;
  }
}
