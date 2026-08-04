import { ApiProperty } from '@nestjs/swagger';
import { AlertStatus } from '../database/entities/alert.entity';

export class AlertResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) healthCenterId!: string;
  @ApiProperty() healthCenterName!: string;
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: AlertStatus }) status!: AlertStatus;
  @ApiProperty({ format: 'date-time', nullable: true })
  resolvedAt!: Date | null;
  @ApiProperty({ format: 'uuid', nullable: true }) resolvedById!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  resolvedByUserId!: string | null;
  @ApiProperty({ nullable: true }) resolvedByName!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
