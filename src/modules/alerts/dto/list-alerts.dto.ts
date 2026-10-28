import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertSeverity,
  AlertStatus,
} from '../../../database/entities/alert.entity';

export class FindAlertsDto {
  @ApiPropertyOptional({ enum: AlertStatus })
  @IsOptional()
  @IsIn(Object.values(AlertStatus))
  status?: AlertStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  healthCenterId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsIn(Object.values(AlertSeverity))
  severity?: AlertSeverity;

  @ApiPropertyOptional({ description: 'Code from the alert_category catalog' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Alerts reported by this patient (any linked report)',
  })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ticketNumber?: string;
}
