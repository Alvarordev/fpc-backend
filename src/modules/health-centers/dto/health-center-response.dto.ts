import { ApiProperty } from '@nestjs/swagger';
import {
  HEALTH_CENTER_CATEGORIES,
  PERU_DEPARTMENTS,
  type HealthCenterCategory,
  type PeruDepartment,
} from '../../../database/entities/health-center.entity';

export class HealthCenterResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: PERU_DEPARTMENTS }) department!: PeruDepartment;
  @ApiProperty({ enum: HEALTH_CENTER_CATEGORIES, nullable: true })
  category!: HealthCenterCategory | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ minimum: 0 }) patientCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
