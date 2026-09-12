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
  @IsOptional() @IsDateString() firstConsultationDate?: string;
  @IsOptional() @IsBoolean() isAwaitingDiagnosis?: boolean | null;
  @IsOptional() @IsBoolean() hasReferral?: boolean | null;
  @IsOptional() @IsUUID() referredHealthCenterId?: string;
  @IsOptional() @IsString() referralNotProvidedReason?: string;
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  nextConsultationDate?: string;
  @IsOptional()
  @IsIn(Object.values(MedicalConsultationStatus))
  consultationStatus?: MedicalConsultationStatus;
  @IsOptional() @IsString() consultationNotObtainedReason?: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsString() @MaxLength(255) specialty?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  diagnosisSearchDuration?: DurationDto;
  @IsOptional() @IsBoolean() hasReceivedDiagnosis?: boolean | null;
  @IsOptional() @IsString() reportedDiagnosis?: string;
  @IsOptional() @IsBoolean() isReceivingReportedTreatment?: boolean | null;
  @IsOptional() @IsString() reportedTreatment?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  reportedTreatmentFrequency?: DurationDto;
  @IsOptional() @IsString() notReceivingTreatmentReason?: string;
}
