import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateVolunteerDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MaxLength(255) firstName!: string;
  @IsString() @MaxLength(255) lastName!: string;
  @IsString() @MaxLength(255) specialty!: string;
  @IsString() @MaxLength(50) phone!: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  commitmentStartAt?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  commitmentEndAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasVolunteerCertificate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  additionalComments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completedSustainabilityModule?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completedDesignThinkingModule?: boolean;
}
