import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertCategory,
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

  @ApiPropertyOptional({ enum: AlertCategory })
  @IsOptional()
  @IsIn(Object.values(AlertCategory))
  category?: AlertCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  underReview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ticketNumber?: string;
}
