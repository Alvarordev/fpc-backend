import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EducationLevel } from '../../../database/entities/education-level.enum';
import { DurationDto } from '../../../shared/duration/duration.dto';

export class UpsertPatientDetailsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  birthDepartment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  primaryHealthCenterId?: string;

  @ApiPropertyOptional({ type: DurationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  travelTimeToHospital?: DurationDto;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  referredToSocialWorker?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  evidenceOfDomesticViolence?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  usesWoodStove?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isWorking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  receivesFinancialSupport?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasConadisCard?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  knowsAboutFissal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  programDropoutReason?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  programDropoutDate?: string;
}
