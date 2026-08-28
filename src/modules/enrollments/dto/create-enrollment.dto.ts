import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AffiliationType } from '../../../database/entities/enrollment.entity';
import { FollowUpType } from '../../../database/entities/follow-up.enums';
import { CreatePatientDiagnosisDto } from '../../patients/clinical/diagnoses/dto/create-patient-diagnosis.dto';
import { CreatePatientInsuranceDto } from '../../patients/clinical/insurance/dto/create-patient-insurance.dto';
import { CreatePatientMedicalAppointmentDto } from '../../patients/clinical/medical-appointments/dto/create-patient-medical-appointment.dto';
import { CreatePatientSisAffiliationDto } from '../../patients/clinical/sis-affiliation/dto/create-patient-sis-affiliation.dto';
import { CreatePatientTreatmentDto } from '../../patients/clinical/treatments/dto/create-patient-treatment.dto';
import { CreatePatientSymptomReportDto } from '../../patients/symptom-reports/dto/create-patient-symptom-report.dto';
import { CreateCompanionDto } from '../../patients/dto/create-companion.dto';
import { CreatePatientDto } from '../../patients/dto/create-patient.dto';
import { UpsertPatientDetailsDto } from '../../patients/dto/upsert-patient-details.dto';
import { CreatePatientAddressDto } from '../../patients/addresses/dto/create-patient-address.dto';
import { CreatePatientHealthBackgroundAssessmentDto } from '../../patients/clinical/health-background/dto/create-patient-health-background-assessment.dto';
import {
  ENROLLMENT_HEALTH_PHASES,
  PatientHealthPhase,
} from '../../../database/entities/patient-health-phase.enum';
import { CompanionContactRole } from '../../../database/entities/companion-contact-role.enum';
import { EnrollmentContactSource } from '../enrollment-contact-source.enum';

export class EnrollmentContactPersonDto extends OmitType(CreateCompanionDto, [
  'email',
  'isPrimaryInformant',
  'isPrimaryContact',
  'contactRole',
  'isCaregiver',
  'relationship',
] as const) {
  @IsString() @MaxLength(50) relationship!: string;
}

export class EnrollmentContactInputDto {
  @ApiProperty({ enum: CompanionContactRole })
  @IsIn(Object.values(CompanionContactRole))
  role!: CompanionContactRole;

  @ApiProperty({ enum: EnrollmentContactSource })
  @IsIn(Object.values(EnrollmentContactSource))
  source!: EnrollmentContactSource;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentContactPersonDto)
  person?: EnrollmentContactPersonDto;
}

export class EnrollmentFollowUpDto {
  @IsIn(Object.values(FollowUpType)) type!: FollowUpType;
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
}

export class CreateEnrollmentFamilyTalkInterestDto {
  @IsString() @MaxLength(255) talkName!: string;
  @IsString() @MaxLength(255) familyMemberName!: string;
  @IsOptional() @IsString() @MaxLength(50) familyMemberPhone?: string;
  @IsOptional() @IsString() @MaxLength(255) familyMemberEmail?: string;
}

export class EnrollmentDiagnosisDto extends OmitType(
  CreatePatientDiagnosisDto,
  ['followUpId'] as const,
) {}
export class EnrollmentTreatmentDto extends OmitType(
  CreatePatientTreatmentDto,
  ['followUpId', 'diagnosisId'] as const,
) {}
export class EnrollmentInsuranceDto extends OmitType(
  CreatePatientInsuranceDto,
  ['followUpId'] as const,
) {}
export class EnrollmentSisAffiliationDto extends OmitType(
  CreatePatientSisAffiliationDto,
  ['followUpId'] as const,
) {}
export class EnrollmentMedicalAppointmentDto extends OmitType(
  CreatePatientMedicalAppointmentDto,
  ['followUpId'] as const,
) {}
export class EnrollmentSymptomReportDto extends OmitType(
  CreatePatientSymptomReportDto,
  ['followUpId', 'enrollmentId'] as const,
) {}
export class EnrollmentAddressDto extends OmitType(CreatePatientAddressDto, [
  'followUpId',
] as const) {}
export class EnrollmentHealthBackgroundAssessmentDto extends OmitType(
  CreatePatientHealthBackgroundAssessmentDto,
  ['followUpId'] as const,
) {}

export class CreateEnrollmentDto {
  @IsOptional() @IsUUID() patientId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePatientDto)
  patient?: CreatePatientDto;
  @ValidateNested()
  @Type(() => EnrollmentFollowUpDto)
  followUp!: EnrollmentFollowUpDto;
  @IsIn(Object.values(AffiliationType)) affiliationType!: AffiliationType;
  @ApiProperty({ enum: ENROLLMENT_HEALTH_PHASES })
  @IsIn(ENROLLMENT_HEALTH_PHASES)
  healthPhase!: PatientHealthPhase;
  @IsOptional() @IsUUID() companionId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCompanionDto)
  companion?: CreateCompanionDto;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnrollmentContactInputDto)
  contacts?: EnrollmentContactInputDto[];
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnrollmentTreatmentDto)
  treatments?: EnrollmentTreatmentDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnrollmentMedicalAppointmentDto)
  medicalAppointments?: EnrollmentMedicalAppointmentDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnrollmentAddressDto)
  addresses?: EnrollmentAddressDto[];
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentSymptomReportDto)
  symptomReport?: EnrollmentSymptomReportDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentHealthBackgroundAssessmentDto)
  healthBackgroundAssessment?: EnrollmentHealthBackgroundAssessmentDto;
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
  @IsOptional() @IsString() caseComments?: string;
  @IsOptional() @IsDateString() callStartedAt?: string;
  @IsOptional() @IsDateString() callEndedAt?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEnrollmentFamilyTalkInterestDto)
  familyPreventionTalkInterests?: CreateEnrollmentFamilyTalkInterestDto[];
}
