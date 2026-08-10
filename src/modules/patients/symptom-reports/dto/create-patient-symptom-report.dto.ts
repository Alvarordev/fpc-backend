import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DurationDto } from '../../../../shared/duration/duration.dto';

export class CreatePatientSymptomReportDto {
  @IsUUID() followUpId!: string;
  @IsOptional() @IsUUID() enrollmentId?: string;
  @IsOptional() @IsString() @MaxLength(20) discomfortSeverity?: string;
  @IsOptional() @IsString() discomfortDescription?: string;
  @IsOptional() @IsBoolean() hasDiscomfort?: boolean;
  @IsOptional() @IsString() signsAndSymptoms?: string;
  @IsOptional() @IsString() indicationsReceived?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  symptomDuration?: DurationDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  symptomFrequency?: DurationDto;
  @IsOptional() @IsBoolean() isPainPresent?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10) painIntensity?: number;
  @IsOptional() @IsString() @MaxLength(255) painLocation?: string;
  @IsOptional() @IsString() painDescription?: string;
  @IsOptional() @IsBoolean() hasSoughtMedicalConsultation?: boolean;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsString() @MaxLength(255) specialty?: string;
}
