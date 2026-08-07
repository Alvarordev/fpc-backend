import { IsIn, IsString, MaxLength } from 'class-validator';
import { PERU_DEPARTMENTS } from '../../../database/entities/health-center.entity';
import type { PeruDepartment } from '../../../database/entities/health-center.entity';

export class CreateHealthCenterDto {
  @IsString() @MaxLength(255) name!: string;
  @IsIn(PERU_DEPARTMENTS) department!: PeruDepartment;
}
