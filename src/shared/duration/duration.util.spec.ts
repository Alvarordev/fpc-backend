import { BadRequestException } from '@nestjs/common';
import { DurationUnit } from '../../database/entities/duration-unit.enum';
import { DurationResponseDto } from './duration-response.dto';
import { normalizeDuration } from './duration.util';

describe('normalizeDuration', () => {
  it('keeps the unit and label of an unspecified amount', () => {
    const duration = normalizeDuration({
      unit: DurationUnit.MONTH,
      label: 'No especifica',
    });

    expect(duration).toMatchObject({
      valueMin: null,
      valueMax: null,
      unit: DurationUnit.MONTH,
      label: 'No especifica',
      canonicalMinutesMin: null,
      canonicalMinutesMax: null,
    });
    expect(DurationResponseDto.from(duration)).toEqual({
      valueMin: null,
      valueMax: null,
      unit: DurationUnit.MONTH,
      label: 'No especifica',
    });
  });

  it('rejects an unspecified amount without a label', () => {
    expect(() => normalizeDuration({ unit: DurationUnit.DAY })).toThrow(
      BadRequestException,
    );
  });

  it('stores an immediate wait as zero days', () => {
    const duration = normalizeDuration({
      valueMin: 0,
      unit: DurationUnit.DAY,
      label: 'Inmediato',
    });

    expect(duration).toMatchObject({
      valueMin: '0',
      label: 'Inmediato',
      canonicalMinutesMin: 0,
    });
  });
});
