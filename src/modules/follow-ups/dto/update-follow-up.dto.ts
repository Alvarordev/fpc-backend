import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FollowUpStatus } from '../../../database/entities/follow-up.enums';

export class UpdateFollowUpDto {
  @IsOptional() @IsUUID() interlocutorId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional()
  @IsIn(Object.values(FollowUpStatus))
  status?: FollowUpStatus;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
}
