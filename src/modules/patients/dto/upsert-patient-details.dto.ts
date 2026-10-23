import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DurationDto } from '../../../shared/duration/duration.dto';

export class UpsertPatientDetailsDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  healthPhase?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  healthSubcategory?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  birthDepartment?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  birthCountry?: string | null;

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

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  zoneType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  emergencyContactGender?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  educationLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nativeLanguage?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  childrenCount?: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  transportationViaSepa?: boolean;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transportationSepaProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transportationSepaProviderOther?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shelterViaSepa?: boolean;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shelterSepaProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shelterSepaProviderOther?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  attendedEducationalTalk?: boolean;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  attendedEducationalTalkAt?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  programDropoutReasonCode?: string;
}
