import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
export class CreateReminderDto {
  @IsUUID() subjectPatientId!: string;
  @IsDateString() dueAt!: string;
  @IsString() description!: string;
  @IsOptional() @IsUUID() assignedAgentId?: string;
  @IsOptional() @IsUUID() createdFromInteractionId?: string;
}
export class UpdateReminderDto {
  @IsOptional() @IsUUID() assignedAgentId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() description?: string;
}
export class CompleteReminderDto {
  @IsOptional() @IsUUID() resultingInteractionId?: string;
}
