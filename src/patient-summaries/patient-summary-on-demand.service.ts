import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PatientSummary,
  PatientSummaryStatus,
} from '../database/entities/patient-summary.entity';
import { Patient } from '../database/entities/patient.entity';
import { GeminiSummaryClient } from './gemini-summary.client';
import { normalizePatientSummaryError } from './patient-summary-error';
import { PatientSummaryPayloadService } from './patient-summary-payload.service';
import { PatientSummaryRateLimiterService } from './patient-summary-rate-limiter.service';
import { PatientSummaryStateService } from './patient-summary-state.service';

@Injectable()
export class PatientSummaryOnDemandService {
  private readonly logger = new Logger(PatientSummaryOnDemandService.name);

  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(PatientSummary)
    private readonly summaries: Repository<PatientSummary>,
    private readonly payloads: PatientSummaryPayloadService,
    private readonly gemini: GeminiSummaryClient,
    private readonly limiter: PatientSummaryRateLimiterService,
    private readonly states: PatientSummaryStateService,
  ) {}

  /**
   * Returns the current summary. Generation only runs when there is no
   * ready summary yet — a READY row is trusted as-is, since patient data
   * changes invalidate it back to PENDING (see PatientSummaryInvalidationListener).
   * This avoids calling the provider on every page view.
   */
  async get(patientId: string) {
    if (!(await this.patients.existsBy({ id: patientId })))
      throw new NotFoundException('Patient not found');

    const stored = await this.summaries.findOneBy({ patientId });
    if (stored?.status === PatientSummaryStatus.READY) {
      return {
        status: PatientSummaryStatus.READY,
        summary: stored.summary,
        model: stored.model,
        source: 'STORED',
      };
    }

    return this.generate(patientId, stored);
  }

  /** Calls the provider again even if a ready summary already exists. */
  async refresh(patientId: string) {
    if (!(await this.patients.existsBy({ id: patientId })))
      throw new NotFoundException('Patient not found');

    const stored = await this.summaries.findOneBy({ patientId });
    return this.generate(patientId, stored);
  }

  private async generate(patientId: string, stored: PatientSummary | null) {
    // Shares the same budget as the background worker so a single on-demand
    // call never collides with a batch the worker is mid-processing.
    const acquired = await this.limiter.tryAcquire();
    if (!acquired) {
      this.logger.warn({
        patientId,
        code: 'RATE_LIMITED',
        message: 'On-demand patient summary skipped: internal budget exhausted',
      });
      if (!stored) await this.states.markPending(patientId);
      return {
        status: stored?.status ?? PatientSummaryStatus.PENDING,
        summary: stored?.summary ?? null,
        model: stored?.model ?? null,
        source: stored?.summary ? 'STORED' : 'PENDING',
      };
    }

    try {
      const generated = await this.gemini.generate(
        await this.payloads.buildPrompt(patientId),
      );
      await this.states.storeReady(patientId, generated);
      return {
        status: PatientSummaryStatus.READY,
        summary: generated.text,
        model: generated.model,
        source: 'ON_DEMAND',
      };
    } catch (error) {
      const normalized = normalizePatientSummaryError(error);
      this.logger.warn({
        patientId,
        code: normalized.code,
        message: 'On-demand patient summary generation failed',
      });
      if (!stored) await this.states.markPending(patientId);
      return {
        status: stored?.status ?? PatientSummaryStatus.PENDING,
        summary: stored?.summary ?? null,
        model: stored?.model ?? null,
        source: stored?.summary ? 'STORED' : 'PENDING',
      };
    }
  }
}
