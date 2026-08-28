import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { DashboardPeriod } from './dashboard-query.dto';

export class DashboardIndicatorQueryDto {
  @ApiPropertyOptional({
    enum: DashboardPeriod,
    example: DashboardPeriod.MONTH,
  })
  @IsOptional()
  @IsIn(Object.values(DashboardPeriod))
  period?: DashboardPeriod;

  @ApiPropertyOptional({ example: 2026, minimum: 2000, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    example: 8,
    minimum: 1,
    maximum: 12,
    description: 'Required with period=month and year. Month is one-based.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Inclusive Lima calendar date. Use with to as an alternative to period/year/month.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-02-01',
    description: 'Exclusive Lima calendar date. Use with from.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({
    example: 'America/Lima',
    default: 'America/Lima',
    description: 'Only America/Lima is supported.',
  })
  @IsOptional()
  @IsIn(['America/Lima'])
  timezone?: string;
}
