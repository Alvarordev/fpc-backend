import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  InteractionPurpose,
  InteractionStatus,
  InteractionType,
} from '../database/entities/interaction.enums';
export class CreateInteractionDto {
  @IsUUID() subjectPatientId!: string;
  @IsUUID() interlocutorId!: string;
  @IsOptional() @IsUUID() agentId?: string;
  @IsIn(Object.values(InteractionType)) type!: InteractionType;
  @IsIn(Object.values(InteractionPurpose)) purpose!: InteractionPurpose;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
}
export class UpdateInteractionDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional()
  @IsIn(Object.values(InteractionStatus))
  status?: InteractionStatus;
  @IsOptional() @IsDateString() completedAt?: string;
}
