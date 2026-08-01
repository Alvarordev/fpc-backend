import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePatientSymptomReportDto {
  @IsUUID() followUpId!: string;
  @IsOptional() @IsUUID() enrollmentId?: string;
  @IsOptional() @IsString() @MaxLength(20) discomfortSeverity?: string;
  @IsOptional() @IsString() discomfortDescription?: string;
  @IsOptional() @IsString() @MaxLength(50) symptomDuration?: string;
  @IsOptional() @IsString() @MaxLength(50) symptomFrequency?: string;
  @IsOptional() @IsBoolean() isPainPresent?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10) painIntensity?: number;
  @IsOptional() @IsString() @MaxLength(255) painLocation?: string;
  @IsOptional() @IsString() painDescription?: string;
  @IsOptional() @IsBoolean() hasSoughtMedicalConsultation?: boolean;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsString() @MaxLength(255) specialty?: string;
}
