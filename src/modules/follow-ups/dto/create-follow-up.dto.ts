import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  FollowUpPurpose,
  FollowUpType,
} from '../../../database/entities/follow-up.enums';

export class CreateFollowUpDto {
  @IsUUID() subjectPatientId!: string;
  @IsUUID() interlocutorId!: string;
  @IsOptional() @IsUUID() agentId?: string;
  @IsIn(Object.values(FollowUpType)) type!: FollowUpType;
  @IsIn(Object.values(FollowUpPurpose)) purpose!: FollowUpPurpose;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
}
