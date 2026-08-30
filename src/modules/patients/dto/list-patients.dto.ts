import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PatientActivityStatus } from '../../../database/entities/patient-activity-status.enum';
import { PatientHealthPhase } from '../../../database/entities/patient-health-phase.enum';
import { PatientHealthSubcategory } from '../../../database/entities/patient-health-subcategory.enum';
import { PatientListSegment } from '../../../database/entities/patient-list-segment.enum';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientStatus } from '../../../database/entities/patient-status.enum';

export const UNASSIGNED_HEALTH_SUBCATEGORY = 'UNASSIGNED' as const;

export class ListPatientsDto {
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

  @ApiPropertyOptional({ enum: PatientHealthPhase })
  @IsOptional()
  @IsIn(Object.values(PatientHealthPhase))
  healthPhase?: PatientHealthPhase;

  @ApiPropertyOptional({
    enum: [
      ...Object.values(PatientHealthSubcategory),
      UNASSIGNED_HEALTH_SUBCATEGORY,
    ],
  })
  @IsOptional()
  @IsIn([
    ...Object.values(PatientHealthSubcategory),
    UNASSIGNED_HEALTH_SUBCATEGORY,
  ])
  healthSubcategory?:
    PatientHealthSubcategory | typeof UNASSIGNED_HEALTH_SUBCATEGORY;

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
