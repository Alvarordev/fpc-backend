import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateVolunteerDto {
  @IsOptional() @IsString() @MaxLength(255) firstName?: string;
  @IsOptional() @IsString() @MaxLength(255) lastName?: string;
  @IsOptional() @IsString() @MaxLength(255) specialty?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsDateString() birthDate?: string | null;
  @IsOptional() @IsDateString() commitmentStartAt?: string | null;
  @IsOptional() @IsDateString() commitmentEndAt?: string | null;
  @IsOptional() @IsBoolean() hasVolunteerCertificate?: boolean;
  @IsOptional() @IsString() @MaxLength(5000) additionalComments?: string | null;
  @IsOptional() @IsBoolean() completedSustainabilityModule?: boolean;
  @IsOptional() @IsBoolean() completedDesignThinkingModule?: boolean;
}
