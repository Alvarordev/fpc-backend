import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  HEALTH_CENTER_CATEGORIES,
  PERU_DEPARTMENTS,
} from '../../../database/entities/health-center.entity';
import type {
  HealthCenterCategory,
  PeruDepartment,
} from '../../../database/entities/health-center.entity';

export class UpdateHealthCenterDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsIn(PERU_DEPARTMENTS) department?: PeruDepartment;
  @IsOptional() @IsIn(HEALTH_CENTER_CATEGORIES) category?: HealthCenterCategory;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
