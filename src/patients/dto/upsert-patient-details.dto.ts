import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EducationLevel } from '../entities/education-level.enum';

export class UpsertPatientDetailsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  birthDepartment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  currentDistrict?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  currentDepartment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dniMatchesAddress?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  travelTimeToHospital?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  zoneType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  emergencyContactGender?: string;

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional()
  @IsIn(Object.values(EducationLevel))
  educationLevel?: EducationLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nativeLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresTranslation?: boolean;
}
