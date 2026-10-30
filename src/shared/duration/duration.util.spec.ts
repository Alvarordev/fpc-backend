import { BadRequestException } from '@nestjs/common';
import { Duration } from '../../database/entities/embedded/duration.embedded';
import { DurationUnit } from '../../database/entities/duration-unit.enum';
import { normalizeDuration } from './duration.util';

function stored(values: Partial<Duration>): Duration {
  return Object.assign(new Duration(), {
    valueMin: null,
    valueMax: null,
    unit: null,
    label: null,
    canonicalMinutesMin: null,
    canonicalMinutesMax: null,
    ...values,
  });
}

describe('normalizeDuration', () => {
  it('keeps a stored empty duration empty instead of writing "null"', () => {
    const duration = normalizeDuration(stored({}));
    expect(duration.valueMin).toBeNull();
    expect(duration.valueMax).toBeNull();
    expect(duration.unit).toBeNull();
  });

  it('re-normalizes a stored duration whose numbers come as text', () => {
    const duration = normalizeDuration(
      stored({ valueMin: '9.00', valueMax: '10.00', unit: DurationUnit.MONTH }),
    );
    expect(duration.valueMin).toBe('9');
    expect(duration.valueMax).toBe('10');
    expect(duration.canonicalMinutesMax).toBeGreaterThan(
      duration.canonicalMinutesMin!,
    );
  });

  it('still rejects a maximum lower than the minimum', () => {
    expect(() =>
      normalizeDuration({ valueMin: 3, valueMax: 2, unit: DurationUnit.DAY }),
    ).toThrow(BadRequestException);
  });
});
