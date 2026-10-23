import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { FollowUpStatus } from '../../../database/entities/follow-up.enums';

export class FindFollowUpsQueryDto {
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsUUID() patientId?: string;
  @IsOptional() @IsIn(Object.values(FollowUpStatus)) status?: FollowUpStatus;
}
