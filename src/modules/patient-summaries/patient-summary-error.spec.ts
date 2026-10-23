import {
  PatientSummaryErrorCode,
  normalizePatientSummaryError,
} from './patient-summary-error';

describe('normalizePatientSummaryError', () => {
  it.each([
    [429, PatientSummaryErrorCode.RATE_LIMITED, true],
    [503, PatientSummaryErrorCode.TEMPORARY_PROVIDER, true],
    [400, PatientSummaryErrorCode.PROVIDER, false],
  ])('normalizes provider status %s', (status, code, retryable) => {
    expect(normalizePatientSummaryError({ status })).toMatchObject({
      code,
      retryable,
    });
  });
});
