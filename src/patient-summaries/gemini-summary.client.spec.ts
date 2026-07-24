import { ConfigService } from '@nestjs/config';
import { GeminiSummaryClient } from './gemini-summary.client';
import { PatientSummaryErrorCode } from './patient-summary-error';

describe('GeminiSummaryClient', () => {
  it('fails through the normalized configuration pipeline when no key is set', async () => {
    const client = new GeminiSummaryClient({
      get: jest.fn().mockReturnValue(''),
      getOrThrow: jest.fn(),
    } as unknown as ConfigService);

    await expect(client.generate('prompt')).rejects.toMatchObject({
      code: PatientSummaryErrorCode.CONFIGURATION,
      retryable: false,
      message: 'GEMINI_API_KEY is not configured',
    });
  });
});
