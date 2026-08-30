import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateReminderDto {
  @IsOptional() @IsUUID() assignedAgentId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
}
