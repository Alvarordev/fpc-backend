import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DashboardPeriod } from './dashboard-query.dto';
import { PatientHealthPhase } from '../../../database/entities/patient-health-phase.enum';
import { PatientHealthSubcategory } from '../../../database/entities/patient-health-subcategory.enum';

export enum DashboardPopulation {
  ALL_ACTIVE = 'all_active',
  ACTIVE_IN_PERIOD = 'active_in_period',
  ENROLLED_IN_PERIOD = 'enrolled_in_period',
}

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

  @ApiPropertyOptional({
    enum: DashboardPopulation,
    default: DashboardPopulation.ALL_ACTIVE,
    description:
      'all_active: patients enrolled before the period end whose last activity event at that moment is ACTIVE/REACTIVE. active_in_period: those of all_active with an enrollment, completed follow-up or psycho-oncology session in the period. enrolled_in_period: first enrollment inside the period, whatever their status.',
  })
  @IsOptional()
  @IsEnum(DashboardPopulation)
  population?: DashboardPopulation;

  @ApiPropertyOptional({
    example: 'LIMA',
    description:
      'Residence department of the primary address (catalog value, case and spaces ignored).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Za-zÑñ _-]+$/)
  department?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Primary health center of the patient.',
  })
  @IsOptional()
  @IsUUID()
  healthCenterId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Patients with at least one follow-up handled by this agent.',
  })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({
    enum: PatientHealthPhase,
    description: 'Current health phase of the patient.',
  })
  @IsOptional()
  @IsEnum(PatientHealthPhase)
  healthPhase?: PatientHealthPhase;

  @ApiPropertyOptional({
    enum: PatientHealthSubcategory,
    description: 'Current health subcategory of the patient.',
  })
  @IsOptional()
  @IsEnum(PatientHealthSubcategory)
  healthSubcategory?: PatientHealthSubcategory;
}
