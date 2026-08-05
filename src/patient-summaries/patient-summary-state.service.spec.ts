import { Repository } from 'typeorm';
import {
  PatientSummary,
  PatientSummaryStatus,
} from '../database/entities/patient-summary.entity';
import { PatientSummaryStateService } from './patient-summary-state.service';

describe('PatientSummaryStateService', () => {
  it('upserts a ready summary keyed by patient', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const service = new PatientSummaryStateService({
      upsert,
    } as unknown as Repository<PatientSummary>);

    await service.storeReady('patient-id', {
      text: 'Summary',
      model: 'gemini-2.0-flash',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-id',
        status: PatientSummaryStatus.READY,
        summary: 'Summary',
      }),
      ['patientId'],
    );
  });
});
