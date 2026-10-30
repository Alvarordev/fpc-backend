import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  HEALTH_CENTER_CATEGORIES,
  HEALTH_CENTER_INSTITUTIONS,
  PERU_DEPARTMENTS,
  type HealthCenterCategory,
  type HealthCenterInstitution,
  type PeruDepartment,
} from '../../../database/entities/health-center.entity';

export class CreateHealthCenterDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;

  @ApiProperty({ enum: PERU_DEPARTMENTS })
  @IsIn(PERU_DEPARTMENTS)
  department!: PeruDepartment;

  @ApiPropertyOptional({ enum: HEALTH_CENTER_CATEGORIES, nullable: true })
  @IsOptional()
  @IsIn(HEALTH_CENTER_CATEGORIES)
  careCategory?: HealthCenterCategory | null;

  @ApiPropertyOptional({ enum: HEALTH_CENTER_INSTITUTIONS, nullable: true })
  @IsOptional()
  @IsIn(HEALTH_CENTER_INSTITUTIONS)
  institution?: HealthCenterInstitution | null;

  @ApiPropertyOptional({ description: 'INEI district code', nullable: true })
  @IsOptional()
  @Matches(/^\d{6}$/)
  ubigeoDistrictCode?: string | null;

  @ApiPropertyOptional({ description: 'RENIPRESS code', nullable: true })
  @IsOptional()
  @Matches(/^\d{1,20}$/)
  renipressCode?: string | null;
}
