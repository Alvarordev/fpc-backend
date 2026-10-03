export function parseCorsOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.includes('*')) {
    throw new Error('CORS_ORIGIN cannot include *');
  }

  return origins;
}
