export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function dateOnlyInLima(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function dateOnlyInLimaFromInput(value: string): string {
  if (DATE_ONLY_PATTERN.test(value)) return value;
  return dateOnlyInLima(new Date(value));
}

export function isDateOnlyRangeValid(
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  return !start || !end || start <= end;
}
