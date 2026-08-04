import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertStatus } from '../database/entities/alert.entity';
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
}
