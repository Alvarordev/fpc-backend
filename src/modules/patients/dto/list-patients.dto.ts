import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PatientActivityStatus } from '../../../database/entities/patient-activity-status.enum';
import { PatientListSegment } from '../../../database/entities/patient-list-segment.enum';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientStatus } from '../../../database/entities/patient-status.enum';

export const UNASSIGNED_HEALTH_SUBCATEGORY = 'UNASSIGNED' as const;

const queryBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class ListPatientsDto {
  @ApiPropertyOptional({
    description: 'Registered primary or secondary phone.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasPhone?: boolean;

  @ApiPropertyOptional({ description: 'At least one linked companion.' })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasCompanion?: boolean;

  @ApiPropertyOptional({
    description:
      'Scheduled or overdue follow-up not superseded by a reschedule.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasPendingFollowUps?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 130 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(130)
  minAge?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 130 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(130)
  maxAge?: number;

  @ApiPropertyOptional({ enum: ['M', 'F', 'OTHER'] })
  @IsOptional()
  @IsIn(['M', 'F', 'OTHER'])
  gender?: string;

  @ApiPropertyOptional({
    description: 'Current primary residence department, case insensitive.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Primary health center.',
  })
  @IsOptional()
  @IsUUID()
  healthCenterId?: string;

  @ApiPropertyOptional({
    description:
      'Current diagnosis code; combined with cancerStage on the same diagnosis.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  diagnosis?: string;

  @ApiPropertyOptional({ description: 'Current cancer stage catalog code.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cancerStage?: string;

  @ApiPropertyOptional({ description: 'Current insurance catalog code.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  insuranceType?: string;

  @ApiPropertyOptional({
    description:
      'Current treatment type; combined with treatmentSituation on the same treatment.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  treatmentType?: string;

  @ApiPropertyOptional({
    description: 'Current treatment situation catalog code.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  treatmentSituation?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'First enrollment on or after this date (inclusive).',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  enrolledFrom?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'First enrollment before this date (exclusive).',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  enrolledTo?: string;

  @ApiPropertyOptional({
    format: 'date',
    description:
      'Last completed contact before this date (exclusive). Excludes patients with no completed contact.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  lastContactBefore?: string;

  @ApiPropertyOptional({
    description: 'Whether a non-empty email is registered.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasEmail?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether the patient has at least one pending reminder, including historical records.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasPendingReminders?: boolean;

  @ApiPropertyOptional({ enum: PatientRole })
  @IsOptional()
  @IsIn(Object.values(PatientRole))
  role?: PatientRole;

  @ApiPropertyOptional({ enum: PatientStatus })
  @IsOptional()
  @IsIn(Object.values(PatientStatus))
  status?: PatientStatus;

  @ApiPropertyOptional({ enum: PatientActivityStatus })
  @IsOptional()
  @IsIn(Object.values(PatientActivityStatus))
  activityStatus?: PatientActivityStatus;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  healthPhase?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  healthSubcategory?: string;

  @ApiPropertyOptional({ enum: PatientListSegment })
  @IsOptional()
  @IsIn(Object.values(PatientListSegment))
  segment?: PatientListSegment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ type: Number, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
