import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertSeverity,
  AlertStatus,
} from '../../../database/entities/alert.entity';

/**
 * Patch semantics: omitted fields are left unchanged; null is rejected.
 * Resolution and derivation have their own endpoints.
 */
export class UpdateAlertDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  healthCenterId?: string | null;
  @ApiPropertyOptional({
    enum: [AlertStatus.REPORTED, AlertStatus.IN_REVIEW],
    description: 'Use PATCH /alerts/:id/resolve to resolve an alert',
  })
  @IsOptional()
  @IsIn([AlertStatus.REPORTED, AlertStatus.IN_REVIEW])
  status?: AlertStatus | null;
  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsIn(Object.values(AlertSeverity))
  severity?: AlertSeverity | null;
  @ApiPropertyOptional({ description: 'Code from the alert_category catalog' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;
}
