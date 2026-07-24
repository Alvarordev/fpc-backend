import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAgentDto {
  @IsOptional() @IsString() @MaxLength(255) fullName?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
}
