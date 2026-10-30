import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertSeverity } from '../../../database/entities/alert.entity';
import { FollowUpType } from '../../../database/entities/follow-up.enums';

export class AlertFollowUpSourceDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Existing follow-up the report comes from',
  })
  @IsOptional()
  @IsUUID()
  followUpId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required when followUpId is omitted; a follow-up is created',
  })
  @IsOptional()
  @IsUUID()
  subjectPatientId?: string;
  @IsOptional() @IsUUID() interlocutorId?: string;
  @IsOptional()
  @IsIn(Object.values(FollowUpType))
  followUpType?: FollowUpType;
  @IsOptional() @IsString() followUpNotes?: string;
}

export class CreateAlertDto extends AlertFollowUpSourceDto {
  @IsUUID() healthCenterId!: string;
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() description!: string;
  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsIn(Object.values(AlertSeverity))
  severity?: AlertSeverity;
  @ApiPropertyOptional({
    description: 'Code from the alert_category catalog. Defaults to GENERAL.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
