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
  input: DurationDto | Duration | null | undefined,
): Duration {
  const duration = new Duration();
  // También recibe la duración ya guardada al fusionar una edición: sus números
  // llegan como texto y una duración vacía trae todas sus columnas en null.
  const dto = input
    ? {
        valueMin: input.valueMin == null ? undefined : Number(input.valueMin),
        valueMax: input.valueMax == null ? undefined : Number(input.valueMax),
        unit: input.unit ?? undefined,
        label: input.label ?? undefined,
      }
    : null;
  if (
    !dto ||
    (dto.valueMin === undefined && dto.valueMax === undefined && !dto.label)
  ) {
    duration.valueMin = null;
    duration.valueMax = null;
    duration.unit = null;
    duration.label = null;
    duration.canonicalMinutesMin = null;
    duration.canonicalMinutesMax = null;
    return duration;
  }

  if (dto.valueMin === undefined) {
    if (!dto.label || dto.valueMax !== undefined)
      throw new BadRequestException(
        'Una duración sin valor mínimo necesita una etiqueta y no puede tener valor máximo.',
      );
    duration.valueMin = null;
    duration.valueMax = null;
    duration.unit = dto.unit ?? null;
    duration.label = dto.label;
    duration.canonicalMinutesMin = null;
    duration.canonicalMinutesMax = null;
    return duration;
  }

  if (!dto.unit)
    throw new BadRequestException('Indica la unidad de la duración.');
  const valueMax = dto.valueMax ?? dto.valueMin;
  if (valueMax < dto.valueMin) {
    throw new BadRequestException(
      'El valor máximo no puede ser menor que el mínimo.',
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

export function durationFromElapsedDays(days: number): DurationDto {
  if (!Number.isFinite(days) || days < 0)
    throw new BadRequestException(
      'Los días transcurridos no pueden ser negativos.',
    );

  if (days < 60) return { valueMin: days, unit: DurationUnit.DAY };
  if (days < 730)
    return {
      valueMin: Math.round((days / 30) * 100) / 100,
      unit: DurationUnit.MONTH,
    };
  return {
    valueMin: Math.round((days / 365) * 100) / 100,
    unit: DurationUnit.YEAR,
  };
}
