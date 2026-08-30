import { IsIn, IsString, MaxLength } from 'class-validator';
import {
  HEALTH_CENTER_CATEGORIES,
  PERU_DEPARTMENTS,
} from '../../../database/entities/health-center.entity';
import type {
  HealthCenterCategory,
  PeruDepartment,
} from '../../../database/entities/health-center.entity';

export class CreateHealthCenterDto {
  @IsString() @MaxLength(255) name!: string;
  @IsIn(PERU_DEPARTMENTS) department!: PeruDepartment;
  @IsIn(HEALTH_CENTER_CATEGORIES) category!: HealthCenterCategory;
}
