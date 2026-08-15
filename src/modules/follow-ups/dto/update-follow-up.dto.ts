import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { FollowUpStatus } from '../../../database/entities/follow-up.enums';

export class UpdateFollowUpDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional()
  @IsIn(Object.values(FollowUpStatus))
  status?: FollowUpStatus;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
}
