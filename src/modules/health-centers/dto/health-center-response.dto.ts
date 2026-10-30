import { ApiProperty } from '@nestjs/swagger';
import {
  HEALTH_CENTER_CARE_LEVELS,
  HEALTH_CENTER_CATEGORIES,
  HEALTH_CENTER_INSTITUTIONS,
  PERU_DEPARTMENTS,
  type HealthCenter,
  type HealthCenterCareLevel,
  type HealthCenterCategory,
  type HealthCenterInstitution,
  type PeruDepartment,
} from '../../../database/entities/health-center.entity';

export class HealthCenterResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: PERU_DEPARTMENTS }) department!: PeruDepartment;
  @ApiProperty({ enum: HEALTH_CENTER_CATEGORIES, nullable: true })
  careCategory!: HealthCenterCategory | null;
  @ApiProperty({ enum: HEALTH_CENTER_CARE_LEVELS, nullable: true })
  careLevel!: HealthCenterCareLevel | null;
  @ApiProperty({ enum: HEALTH_CENTER_INSTITUTIONS, nullable: true })
  institution!: HealthCenterInstitution | null;
  @ApiProperty({ nullable: true }) ubigeoDistrictCode!: string | null;
  @ApiProperty({ nullable: true }) renipressCode!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ minimum: 0 }) patientCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;

  static from(item: HealthCenter): HealthCenterResponseDto {
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      department: item.department,
      careCategory: item.careCategory,
      careLevel: item.careLevel,
      institution: item.institution,
      ubigeoDistrictCode: item.ubigeoDistrictCode,
      renipressCode: item.renipressCode,
      isActive: item.isActive,
      patientCount: item.patientCount ?? 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
