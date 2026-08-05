import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertCategory,
  AlertSeverity,
  AlertStatus,
} from '../database/entities/alert.entity';
import { FollowUpType } from '../database/entities/follow-up.enums';

export class CreateAlertDto {
  @IsUUID() healthCenterId!: string;
  @IsOptional() @IsUUID() followUpId?: string;
  @IsOptional() @IsUUID() subjectPatientId?: string;
  @IsOptional() @IsUUID() interlocutorId?: string;
  @IsOptional()
  @IsIn(Object.values(FollowUpType))
  followUpType?: FollowUpType;
  @IsOptional() @IsString() followUpNotes?: string;
  @IsString() title!: string;
  @IsString() description!: string;
  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsIn(Object.values(AlertSeverity))
  severity?: AlertSeverity;
  @ApiPropertyOptional({ enum: AlertCategory })
  @IsOptional()
  @IsIn(Object.values(AlertCategory))
  category?: AlertCategory;
}

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

export class CreateAlertEventDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
}
