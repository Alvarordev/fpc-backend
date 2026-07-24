import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { InteractionType } from '../database/entities/interaction.enums';

export class CreateAlertDto {
  @IsUUID() healthCenterId!: string;
  @IsOptional() @IsUUID() interactionId?: string;
  @IsOptional() @IsUUID() subjectPatientId?: string;
  @IsOptional() @IsUUID() interlocutorId?: string;
  @IsOptional()
  @IsIn(Object.values(InteractionType))
  interactionType?: InteractionType;
  @IsOptional() @IsString() interactionNotes?: string;
  @IsString() title!: string;
  @IsString() description!: string;
}
