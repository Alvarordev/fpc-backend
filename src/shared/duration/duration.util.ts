import { BadRequestException } from '@nestjs/common';
import { DurationUnit } from '../../database/entities/duration-unit.enum';
import { Duration } from '../../database/entities/embedded/duration.embedded';
import { DurationDto } from './duration.dto';

const MINUTES_PER_UNIT: Record<DurationUnit, number> = {
  [DurationUnit.MINUTE]: 1,
  [DurationUnit.HOUR]: 60,
  [DurationUnit.DAY]: 60 * 24,
  [DurationUnit.WEEK]: 60 * 24 * 7,
  [DurationUnit.MONTH]: 60 * 24 * 30,
  [DurationUnit.YEAR]: 60 * 24 * 365,
};

const UNIT_LABEL_SINGULAR: Record<DurationUnit, string> = {
  [DurationUnit.MINUTE]: 'minuto',
  [DurationUnit.HOUR]: 'hora',
  [DurationUnit.DAY]: 'día',
  [DurationUnit.WEEK]: 'semana',
  [DurationUnit.MONTH]: 'mes',
  [DurationUnit.YEAR]: 'año',
};

const UNIT_LABEL_PLURAL: Record<DurationUnit, string> = {
  [DurationUnit.MINUTE]: 'minutos',
  [DurationUnit.HOUR]: 'horas',
  [DurationUnit.DAY]: 'días',
  [DurationUnit.WEEK]: 'semanas',
  [DurationUnit.MONTH]: 'meses',
  [DurationUnit.YEAR]: 'años',
};

function formatAmount(value: number, unit: DurationUnit): string {
  const label =
    value === 1 ? UNIT_LABEL_SINGULAR[unit] : UNIT_LABEL_PLURAL[unit];
  return `${value} ${label}`;
}

function defaultLabel(
  valueMin: number,
  valueMax: number | undefined,
  unit: DurationUnit,
): string {
  if (valueMax === undefined || valueMax === valueMin)
    return formatAmount(valueMin, unit);
  return `Entre ${valueMin} y ${formatAmount(valueMax, unit)}`;
}

export function normalizeDuration(
  dto: DurationDto | null | undefined,
): Duration {
  const duration = new Duration();
  if (!dto) {
    duration.valueMin = null;
    duration.valueMax = null;
    duration.unit = null;
    duration.label = null;
    duration.canonicalMinutesMin = null;
    duration.canonicalMinutesMax = null;
    return duration;
  }

  const valueMax = dto.valueMax ?? dto.valueMin;
  if (valueMax < dto.valueMin) {
    throw new BadRequestException(
      'valueMax must be greater than or equal to valueMin',
    );
  }

  const minutesPerUnit = MINUTES_PER_UNIT[dto.unit];
  duration.valueMin = String(dto.valueMin);
  duration.valueMax = String(valueMax);
  duration.unit = dto.unit;
  duration.label =
    dto.label ?? defaultLabel(dto.valueMin, dto.valueMax, dto.unit);
  duration.canonicalMinutesMin = Math.round(dto.valueMin * minutesPerUnit);
  duration.canonicalMinutesMax = Math.round(valueMax * minutesPerUnit);
  return duration;
}
