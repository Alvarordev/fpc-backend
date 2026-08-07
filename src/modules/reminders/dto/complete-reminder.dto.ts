import { IsOptional, IsUUID } from 'class-validator';

export class CompleteReminderDto {
  @IsOptional() @IsUUID() resultingFollowUpId?: string;
}
