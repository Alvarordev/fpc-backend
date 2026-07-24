import { Repository } from 'typeorm';
import {
  PatientSummary,
  PatientSummaryStatus,
} from '../database/entities/patient-summary.entity';
import { PatientSummaryStateService } from './patient-summary-state.service';

describe('PatientSummaryStateService', () => {
  it('only completes a summary that is still claimed for processing', async () => {
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const service = new PatientSummaryStateService({
      update,
    } as unknown as Repository<PatientSummary>);

    await service.markReady('summary-id', {
      text: 'Summary',
      model: 'gemini-2.0-flash',
    });

    expect(update).toHaveBeenCalledWith(
      { id: 'summary-id', status: PatientSummaryStatus.PROCESSING },
      expect.objectContaining({
        status: PatientSummaryStatus.READY,
        summary: 'Summary',
        processingStartedAt: null,
      }),
    );
  });
});
