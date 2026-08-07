import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertCategory,
  AlertSeverity,
  AlertStatus,
} from '../../../database/entities/alert.entity';

/**
 * Patch semantics: a field absent from the request body (undefined) means
 * "no change". A field explicitly sent as `null` means "clear it" and is
 * only accepted by the service for the nullable columns (derivedTo,
 * derivationNotes). Sending `null` for any other field is rejected with 400.
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
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  followUpId?: string | null;
  @ApiPropertyOptional({ enum: AlertStatus })
  @IsOptional()
  @IsIn(Object.values(AlertStatus))
  status?: AlertStatus | null;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  underReview?: boolean | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  derivedTo?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  derivationNotes?: string | null;
  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsIn(Object.values(AlertSeverity))
  severity?: AlertSeverity | null;
  @ApiPropertyOptional({ enum: AlertCategory })
  @IsOptional()
  @IsIn(Object.values(AlertCategory))
  category?: AlertCategory | null;
}
