import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PERU_DEPARTMENTS } from '../../../database/entities/health-center.entity';
import type { PeruDepartment } from '../../../database/entities/health-center.entity';

export class UpdateHealthCenterDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsIn(PERU_DEPARTMENTS) department?: PeruDepartment;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
