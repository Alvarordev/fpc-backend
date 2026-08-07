import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum DashboardPeriod {
  MONTH = 'month',
  YEAR = 'year',
}

export class DashboardQueryDto {
  @ApiProperty({ enum: DashboardPeriod, example: DashboardPeriod.MONTH })
  @IsIn(Object.values(DashboardPeriod))
  period!: DashboardPeriod;

  @ApiProperty({ example: 2026, minimum: 2000, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiPropertyOptional({
    example: 8,
    minimum: 1,
    maximum: 12,
    description: 'Required when period is month. Month number is one-based.',
  })
  @ValidateIf((dto: DashboardQueryDto) => dto.period === DashboardPeriod.MONTH)
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    example: 'America/Lima',
    default: 'America/Lima',
    description: 'Dashboard calendar timezone. Only America/Lima is supported.',
  })
  @IsOptional()
  @IsString()
  @IsIn(['America/Lima'])
  timezone?: string;
}
