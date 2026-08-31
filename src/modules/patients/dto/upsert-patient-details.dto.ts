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
import { ProgramDropoutReasonCode } from '../../../database/entities/program-dropout-reason-code.enum';
import { ShelterSepaProvider } from '../../../database/entities/shelter-sepa-provider.enum';
import { TransportationSepaProvider } from '../../../database/entities/transportation-sepa-provider.enum';
import { PatientHealthPhase } from '../../../database/entities/patient-health-phase.enum';
import { PatientHealthSubcategory } from '../../../database/entities/patient-health-subcategory.enum';
import { DurationDto } from '../../../shared/duration/duration.dto';

export class UpsertPatientDetailsDto {
  @ApiPropertyOptional({ enum: PatientHealthPhase })
  @IsOptional()
  @IsIn(Object.values(PatientHealthPhase))
  healthPhase?: PatientHealthPhase;

  @ApiPropertyOptional({ enum: PatientHealthSubcategory, nullable: true })
  @IsOptional()
  @IsIn(Object.values(PatientHealthSubcategory))
  healthSubcategory?: PatientHealthSubcategory | null;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  transportationViaSepa?: boolean;

  @ApiPropertyOptional({ enum: TransportationSepaProvider })
  @IsOptional()
  @IsIn(Object.values(TransportationSepaProvider))
  transportationSepaProvider?: TransportationSepaProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transportationSepaProviderOther?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shelterViaSepa?: boolean;

  @ApiPropertyOptional({ enum: ShelterSepaProvider })
  @IsOptional()
  @IsIn(Object.values(ShelterSepaProvider))
  shelterSepaProvider?: ShelterSepaProvider;

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

  @ApiPropertyOptional({ enum: ProgramDropoutReasonCode })
  @IsOptional()
  @IsIn(Object.values(ProgramDropoutReasonCode))
  programDropoutReasonCode?: ProgramDropoutReasonCode;
}
