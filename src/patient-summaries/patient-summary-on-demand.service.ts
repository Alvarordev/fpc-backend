import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PatientSummary,
  PatientSummaryStatus,
} from '../database/entities/patient-summary.entity';
import { Patient } from '../patients/entities/patient.entity';
import { GeminiSummaryClient } from './gemini-summary.client';
import { PatientSummaryPayloadService } from './patient-summary-payload.service';
import { PatientSummaryStateService } from './patient-summary-state.service';

@Injectable()
export class PatientSummaryOnDemandService {
  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(PatientSummary)
    private readonly summaries: Repository<PatientSummary>,
    private readonly payloads: PatientSummaryPayloadService,
    private readonly gemini: GeminiSummaryClient,
    private readonly states: PatientSummaryStateService,
  ) {}

  async get(patientId: string) {
    if (!(await this.patients.existsBy({ id: patientId })))
      throw new NotFoundException('Patient not found');

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
    } catch {
      const stored = await this.summaries.findOneBy({ patientId });
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
