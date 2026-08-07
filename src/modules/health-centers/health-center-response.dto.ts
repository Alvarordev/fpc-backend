import { ApiProperty } from '@nestjs/swagger';
import {
  PERU_DEPARTMENTS,
  type PeruDepartment,
} from '../../database/entities/health-center.entity';

export class HealthCenterResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: PERU_DEPARTMENTS }) department!: PeruDepartment;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ minimum: 0 }) patientCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
