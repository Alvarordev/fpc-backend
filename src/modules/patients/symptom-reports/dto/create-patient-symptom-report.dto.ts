import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DurationDto } from '../../../../shared/duration/duration.dto';
import { MedicalConsultationStatus } from '../../../../database/entities/medical-consultation-status.enum';
import { IsIn } from 'class-validator';
import { DATE_ONLY_PATTERN } from '../../../../shared/date-only/date-only.util';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePatientSymptomReportDto {
  @IsUUID() followUpId!: string;
  @IsOptional() @IsUUID() enrollmentId?: string;
  @IsOptional() @IsString() @MaxLength(20) discomfortSeverity?: string;
  @IsOptional() @IsString() discomfortDescription?: string;
  @IsOptional() @IsBoolean() hasDiscomfort?: boolean | null;
  @IsOptional() @IsString() checkupMotivation?: string;
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
  @IsOptional() @IsBoolean() hasRequestedMedicalConsultation?: boolean | null;
  @IsOptional() @IsBoolean() hasMedicalConsultation?: boolean | null;
  @IsOptional() @IsString() noMedicalConsultationReason?: string;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsDateString()
  firstConsultationDate?: string;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsBoolean()
  isAwaitingDiagnosis?: boolean | null;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsBoolean()
  hasReferral?: boolean | null;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsUUID()
  referredHealthCenterId?: string;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  referralNotProvidedReason?: string;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  nextConsultationDate?: string;
  @IsOptional()
  @IsIn(Object.values(MedicalConsultationStatus))
  consultationStatus?: MedicalConsultationStatus;
  @IsOptional() @IsString() consultationNotObtainedReason?: string;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsUUID()
  healthCenterId?: string;
  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Legacy owner field. Persist on patient_medical_appointments instead.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialty?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  diagnosisSearchDuration?: DurationDto;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsBoolean()
  hasReceivedDiagnosis?: boolean | null;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  reportedDiagnosis?: string;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsBoolean()
  isReceivingReportedTreatment?: boolean | null;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  reportedTreatment?: string;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  reportedTreatmentFrequency?: DurationDto;
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  notReceivingTreatmentReason?: string;
}
