import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AffiliationType } from '../database/entities/enrollment.entity';
import { InteractionType } from '../database/entities/interaction.enums';
import { CreatePatientDiagnosisDto } from '../patients/clinical/diagnoses/patient-diagnoses.dto';
import { CreatePatientInsuranceDto } from '../patients/clinical/insurance/patient-insurance.dto';
import { CreatePatientMedicalAppointmentDto } from '../patients/clinical/medical-appointments/patient-medical-appointments.dto';
import { CreatePatientSisAffiliationDto } from '../patients/clinical/sis-affiliation/patient-sis-affiliation.dto';
import { CreatePatientTreatmentDto } from '../patients/clinical/treatments/patient-treatments.dto';
import { CreatePatientSymptomReportDto } from '../patients/symptom-reports/patient-symptom-reports.dto';
import { CreateCompanionDto } from '../patients/dto/create-companion.dto';
import { CreatePatientDto } from '../patients/dto/create-patient.dto';
import { UpsertPatientDetailsDto } from '../patients/dto/upsert-patient-details.dto';

export class EnrollmentInteractionDto {
  @IsIn(Object.values(InteractionType)) type!: InteractionType;
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
}

export class EnrollmentDiagnosisDto extends OmitType(
  CreatePatientDiagnosisDto,
  ['interactionId'] as const,
) {}
export class EnrollmentTreatmentDto extends OmitType(
  CreatePatientTreatmentDto,
  ['interactionId', 'diagnosisId'] as const,
) {}
export class EnrollmentInsuranceDto extends OmitType(
  CreatePatientInsuranceDto,
  ['interactionId'] as const,
) {}
export class EnrollmentSisAffiliationDto extends OmitType(
  CreatePatientSisAffiliationDto,
  ['interactionId'] as const,
) {}
export class EnrollmentMedicalAppointmentDto extends OmitType(
  CreatePatientMedicalAppointmentDto,
  ['interactionId'] as const,
) {}
export class EnrollmentSymptomReportDto extends OmitType(
  CreatePatientSymptomReportDto,
  ['interactionId', 'enrollmentId'] as const,
) {}

export class CreateEnrollmentDto {
  @IsOptional() @IsUUID() patientId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePatientDto)
  patient?: CreatePatientDto;
  @ValidateNested()
  @Type(() => EnrollmentInteractionDto)
  interaction!: EnrollmentInteractionDto;
  @IsIn(Object.values(AffiliationType)) affiliationType!: AffiliationType;
  @IsOptional() @IsUUID() companionId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCompanionDto)
  companion?: CreateCompanionDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertPatientDetailsDto)
  details?: UpsertPatientDetailsDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentInsuranceDto)
  insurance?: EnrollmentInsuranceDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentSisAffiliationDto)
  sisAffiliation?: EnrollmentSisAffiliationDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentDiagnosisDto)
  diagnosis?: EnrollmentDiagnosisDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentTreatmentDto)
  treatment?: EnrollmentTreatmentDto;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnrollmentMedicalAppointmentDto)
  medicalAppointments?: EnrollmentMedicalAppointmentDto[];
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentSymptomReportDto)
  symptomReport?: EnrollmentSymptomReportDto;
  @IsOptional() @IsBoolean() currentlyAttendingConsultations?: boolean;
  @IsOptional() @IsBoolean() currentlyReceivingTreatment?: boolean;
  @IsOptional() @IsString() @MaxLength(50) entrySource?: string;
  @IsOptional() @IsString() @MaxLength(50) entrySubSource?: string;
  @IsOptional() @IsBoolean() consentToContact?: boolean;
  @IsOptional() @IsBoolean() consentToShareData?: boolean;
  @IsOptional() @IsBoolean() requiresTransportation?: boolean;
  @IsOptional() @IsBoolean() hasMobilityIssues?: boolean;
  @IsOptional() @IsBoolean() isOncologicalPatient?: boolean;
  @IsOptional() @IsBoolean() surveyAccepted?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(5) interactionQualityRating?: number;
}
