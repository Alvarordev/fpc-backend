export enum PatientSummaryErrorCode {
  CONFIGURATION = 'CONFIGURATION',
  RATE_LIMITED = 'RATE_LIMITED',
  TEMPORARY_PROVIDER = 'TEMPORARY_PROVIDER',
  PROVIDER = 'PROVIDER',
  SOURCE_NOT_FOUND = 'SOURCE_NOT_FOUND',
}

export class PatientSummaryError extends Error {
  constructor(
    readonly code: PatientSummaryErrorCode,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = 'PatientSummaryError';
  }
}

export function normalizePatientSummaryError(
  error: unknown,
): PatientSummaryError {
  if (error instanceof PatientSummaryError) return error;

  const status = providerStatus(error);
  if (status === 429)
    return new PatientSummaryError(
      PatientSummaryErrorCode.RATE_LIMITED,
      true,
      'The summary provider is rate limited',
    );
  if (status === 408 || (status !== undefined && status >= 500))
    return new PatientSummaryError(
      PatientSummaryErrorCode.TEMPORARY_PROVIDER,
      true,
      'The summary provider is temporarily unavailable',
    );
  return new PatientSummaryError(
    PatientSummaryErrorCode.PROVIDER,
    false,
    'The summary provider could not generate a summary',
  );
}

function providerStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.response?.status;
  return typeof status === 'number' ? status : undefined;
}
