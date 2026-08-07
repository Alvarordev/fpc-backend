import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReminderDto {
  @IsUUID() subjectPatientId!: string;
  @IsDateString() dueAt!: string;
  @IsString() description!: string;
  @IsOptional() @IsUUID() assignedAgentId?: string;
  @IsOptional() @IsUUID() createdFromFollowUpId?: string;
}
