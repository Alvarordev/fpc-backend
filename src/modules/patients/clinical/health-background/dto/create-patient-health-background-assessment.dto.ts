import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LimitationCause } from '../../../../../database/entities/patient-health-background-assessment.entity';

export class CreatePatientActiveComorbidityDto {
  @IsString() @IsNotEmpty() conditionName!: string;

  @IsOptional() @IsString() treatmentDescription?: string;

  @IsOptional() @IsString() @MaxLength(255) followUpSpecialty?: string;
}

export class CreatePatientLimitationDto {
  @IsString() @IsNotEmpty() description!: string;

  @IsIn(Object.values(LimitationCause)) cause!: LimitationCause;
}

export class CreatePatientFamilyCancerHistoryDto {
  @IsString() @IsNotEmpty() relationship!: string;

  @IsOptional() @IsString() cancerType?: string;
}

export class CreatePatientHealthBackgroundAssessmentDto {
  @IsUUID() followUpId!: string;

  @IsOptional() @IsBoolean() hasPsychiatry?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePatientActiveComorbidityDto)
  activeComorbidities?: CreatePatientActiveComorbidityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePatientLimitationDto)
  limitations?: CreatePatientLimitationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePatientFamilyCancerHistoryDto)
  familyCancerHistory?: CreatePatientFamilyCancerHistoryDto[];
}
