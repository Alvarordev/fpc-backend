import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { GeminiSummaryClient } from './gemini-summary.client';
import { PatientSummaryPayloadService } from './patient-summary-payload.service';
import { PatientSummaryRateLimiterService } from './patient-summary-rate-limiter.service';
import { PatientSummaryStateService } from './patient-summary-state.service';
import { PatientSummaryWorkerService } from './patient-summary-worker.service';

describe('PatientSummaryWorkerService', () => {
  it('requeues claimed jobs when the distributed quota is exhausted', async () => {
    const stateMock = {
      recoverTimedOut: jest.fn().mockResolvedValue(0),
      requeue: jest.fn().mockResolvedValue(undefined),
    };
    const states = stateMock as unknown as PatientSummaryStateService;
    const service = new PatientSummaryWorkerService(
      {} as DataSource,
      {
        getOrThrow: jest.fn().mockReturnValueOnce(300).mockReturnValueOnce(2),
      } as unknown as ConfigService,
      {} as PatientSummaryPayloadService,
      {} as GeminiSummaryClient,
      {
        tryAcquire: jest.fn().mockResolvedValue(false),
      } as unknown as PatientSummaryRateLimiterService,
      states,
    );
    jest.spyOn(service, 'claimBatch').mockResolvedValue([
      { id: 'summary-1', patient_id: 'patient-1', attempt_count: 1 },
      { id: 'summary-2', patient_id: 'patient-2', attempt_count: 1 },
    ]);

    await service.processBatch();

    expect(stateMock.requeue).toHaveBeenCalledTimes(2);
  });

  it('claims pending work with SKIP LOCKED before marking it processing', async () => {
    const queries: string[] = [];
    let queryCount = 0;
    const query = (sql: string): Promise<unknown> => {
      queries.push(sql);
      queryCount += 1;
      if (queryCount === 1)
        return Promise.resolve([
          { id: 'summary-1', patient_id: 'patient-1', attempt_count: 0 },
        ]);
      return Promise.resolve(undefined);
    };
    const transaction = jest
      .fn()
      .mockImplementation(
        (work: (manager: { query: typeof query }) => Promise<unknown>) =>
          work({ query }),
      );
    const service = new PatientSummaryWorkerService(
      { transaction } as unknown as DataSource,
      {} as ConfigService,
      {} as PatientSummaryPayloadService,
      {} as GeminiSummaryClient,
      {} as PatientSummaryRateLimiterService,
      {} as PatientSummaryStateService,
    );

    await expect(service.claimBatch(5)).resolves.toEqual([
      { id: 'summary-1', patient_id: 'patient-1', attempt_count: 1 },
    ]);
    expect(queries[0]).toContain('FOR UPDATE SKIP LOCKED');
  });
});
