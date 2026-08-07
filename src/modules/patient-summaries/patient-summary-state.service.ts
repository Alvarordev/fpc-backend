import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PatientSummary,
  PatientSummaryStatus,
} from '../../database/entities/patient-summary.entity';

@Injectable()
export class PatientSummaryStateService {
  constructor(
    @InjectRepository(PatientSummary)
    private readonly summaries: Repository<PatientSummary>,
  ) {}

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
}
