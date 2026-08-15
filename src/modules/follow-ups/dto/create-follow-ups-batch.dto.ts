import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import {
  FollowUpPurpose,
  FollowUpType,
} from '../../../database/entities/follow-up.enums';

export class CreateScheduledFollowUpDto {
  @IsUUID() subjectPatientId!: string;
  @IsUUID() interlocutorId!: string;
  @IsOptional() @IsUUID() agentId?: string;
  @IsIn(Object.values(FollowUpType)) type!: FollowUpType;
  @IsIn(Object.values(FollowUpPurpose)) purpose!: FollowUpPurpose;
  @IsOptional() @IsString() notes?: string;
  @IsDateString() scheduledAt!: string;
}

export class CreateFollowUpsBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateScheduledFollowUpDto)
  followUps!: CreateScheduledFollowUpDto[];
}
