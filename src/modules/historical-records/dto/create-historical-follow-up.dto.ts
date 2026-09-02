import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../../../database/entities/follow-up.enums';
import { SocialNoteType } from '../../../database/entities/patient-social-note.entity';
import { DATE_ONLY_PATTERN } from '../../../shared/date-only/date-only.util';
import {
  EnrollmentAddressDto,
  EnrollmentDiagnosisDto,
  EnrollmentHealthBackgroundAssessmentDto,
  EnrollmentInsuranceDto,
  EnrollmentSisAffiliationDto,
  EnrollmentSymptomReportDto,
  EnrollmentTreatmentDto,
} from '../../enrollments/dto/create-enrollment.dto';
import { UpsertPatientDetailsDto } from '../../patients/dto/upsert-patient-details.dto';

export class HistoricalFollowUpSocialNoteDto {
  @ApiProperty({ enum: SocialNoteType })
  @IsIn(Object.values(SocialNoteType))
  type!: SocialNoteType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  note!: string;
}

/** Treatment may reference a new diagnosis via clientRef or an existing one via diagnosisId. */
export class HistoricalFollowUpTreatmentDto extends EnrollmentTreatmentDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Existing diagnosis id; use this or diagnosisRef, not both when diagnoses[] also creates new ones',
  })
  @IsOptional()
  @IsUUID()
  diagnosisId?: string;
}

export class CreateHistoricalFollowUpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectPatientId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  interlocutorId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  agentId!: string;

  @ApiProperty({ enum: FollowUpType })
  @IsIn(Object.values(FollowUpType))
  type!: FollowUpType;

  @ApiProperty({ enum: FollowUpPurpose })
  @IsIn(Object.values(FollowUpPurpose))
  purpose!: FollowUpPurpose;

  @ApiProperty({ enum: FollowUpStatus })
  @IsIn(Object.values(FollowUpStatus))
  status!: FollowUpStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  scheduledOn?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  completedOn?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional({ type: UpsertPatientDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertPatientDetailsDto)
  details?: UpsertPatientDetailsDto;

  @ApiPropertyOptional({ type: EnrollmentDiagnosisDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnrollmentDiagnosisDto)
  diagnoses?: EnrollmentDiagnosisDto[];

  @ApiPropertyOptional({ type: HistoricalFollowUpTreatmentDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoricalFollowUpTreatmentDto)
  treatments?: HistoricalFollowUpTreatmentDto[];

  @ApiPropertyOptional({ type: EnrollmentSymptomReportDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentSymptomReportDto)
  symptomReport?: EnrollmentSymptomReportDto;

  @ApiPropertyOptional({ type: EnrollmentHealthBackgroundAssessmentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentHealthBackgroundAssessmentDto)
  healthBackgroundAssessment?: EnrollmentHealthBackgroundAssessmentDto;

  @ApiPropertyOptional({ type: EnrollmentInsuranceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentInsuranceDto)
  insurance?: EnrollmentInsuranceDto;

  @ApiPropertyOptional({ type: EnrollmentSisAffiliationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentSisAffiliationDto)
  sisAffiliation?: EnrollmentSisAffiliationDto;

  @ApiPropertyOptional({ type: EnrollmentAddressDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnrollmentAddressDto)
  addresses?: EnrollmentAddressDto[];

  @ApiPropertyOptional({ type: HistoricalFollowUpSocialNoteDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoricalFollowUpSocialNoteDto)
  socialNotes?: HistoricalFollowUpSocialNoteDto[];
}

export class UpdateHistoricalDiagnosisDto extends EnrollmentDiagnosisDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateHistoricalTreatmentDto extends HistoricalFollowUpTreatmentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateHistoricalAddressDto extends EnrollmentAddressDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateHistoricalSocialNoteDto extends HistoricalFollowUpSocialNoteDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateHistoricalSymptomReportDto extends EnrollmentSymptomReportDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateHistoricalHealthBackgroundDto extends EnrollmentHealthBackgroundAssessmentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateHistoricalInsuranceDto extends EnrollmentInsuranceDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateHistoricalSisAffiliationDto extends EnrollmentSisAffiliationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateHistoricalFollowUpDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  interlocutorId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ enum: FollowUpType })
  @IsOptional()
  @IsIn(Object.values(FollowUpType))
  type?: FollowUpType;

  @ApiPropertyOptional({ enum: FollowUpPurpose })
  @IsOptional()
  @IsIn(Object.values(FollowUpPurpose))
  purpose?: FollowUpPurpose;

  @ApiPropertyOptional({ enum: FollowUpStatus })
  @IsOptional()
  @IsIn(Object.values(FollowUpStatus))
  status?: FollowUpStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  scheduledOn?: string | null;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  completedOn?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  completedAt?: string | null;

  @ApiPropertyOptional({ type: UpsertPatientDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertPatientDetailsDto)
  details?: UpsertPatientDetailsDto;

  @ApiPropertyOptional({ type: UpdateHistoricalDiagnosisDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateHistoricalDiagnosisDto)
  diagnoses?: UpdateHistoricalDiagnosisDto[];

  @ApiPropertyOptional({ type: UpdateHistoricalTreatmentDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateHistoricalTreatmentDto)
  treatments?: UpdateHistoricalTreatmentDto[];

  @ApiPropertyOptional({ type: UpdateHistoricalSymptomReportDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHistoricalSymptomReportDto)
  symptomReport?: UpdateHistoricalSymptomReportDto;

  @ApiPropertyOptional({ type: UpdateHistoricalHealthBackgroundDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHistoricalHealthBackgroundDto)
  healthBackgroundAssessment?: UpdateHistoricalHealthBackgroundDto;

  @ApiPropertyOptional({ type: UpdateHistoricalInsuranceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHistoricalInsuranceDto)
  insurance?: UpdateHistoricalInsuranceDto;

  @ApiPropertyOptional({ type: UpdateHistoricalSisAffiliationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHistoricalSisAffiliationDto)
  sisAffiliation?: UpdateHistoricalSisAffiliationDto;

  @ApiPropertyOptional({ type: UpdateHistoricalAddressDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateHistoricalAddressDto)
  addresses?: UpdateHistoricalAddressDto[];

  @ApiPropertyOptional({ type: UpdateHistoricalSocialNoteDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateHistoricalSocialNoteDto)
  socialNotes?: UpdateHistoricalSocialNoteDto[];
}
