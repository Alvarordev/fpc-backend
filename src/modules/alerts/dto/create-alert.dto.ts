import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertCategory,
  AlertSeverity,
} from '../../../database/entities/alert.entity';
import { FollowUpType } from '../../../database/entities/follow-up.enums';

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
