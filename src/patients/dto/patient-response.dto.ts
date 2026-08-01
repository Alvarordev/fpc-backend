import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PatientSummaryStatus } from '../../database/entities/patient-summary.entity';
import { CompanionPatient } from '../entities/companion-patient.entity';
import { DeactivationReason } from '../entities/deactivation-reason.enum';
import { EducationLevel } from '../entities/education-level.enum';
import { PatientDetails } from '../entities/patient-details.entity';
import { PatientRole } from '../entities/patient-role.enum';
import { PatientStatus } from '../entities/patient-status.enum';
import { Patient } from '../entities/patient.entity';

export class PatientDetailsResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ nullable: true })
  birthDepartment!: string | null;

  @ApiProperty({ nullable: true })
  currentAddress!: string | null;

  @ApiProperty({ nullable: true })
  currentDistrict!: string | null;

  @ApiProperty({ nullable: true })
  currentDepartment!: string | null;

  @ApiProperty({ nullable: true })
  dniMatchesAddress!: boolean | null;

  @ApiProperty({ nullable: true })
  travelTimeToHospital!: string | null;

  @ApiProperty({ nullable: true })
  emergencyContactName!: string | null;

  @ApiProperty({ nullable: true })
  emergencyContactPhone!: string | null;

  @ApiProperty({ nullable: true })
  zoneType!: string | null;

  @ApiProperty({ nullable: true })
  emergencyContactGender!: string | null;

  @ApiProperty({ enum: EducationLevel, nullable: true })
  educationLevel!: EducationLevel | null;

  @ApiProperty({ nullable: true })
  nativeLanguage!: string | null;

  @ApiProperty()
  requiresTranslation!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(details: PatientDetails): PatientDetailsResponseDto {
    return {
      id: details.id,
      patientId: details.patientId,
      birthDepartment: details.birthDepartment,
      currentAddress: details.currentAddress,
      currentDistrict: details.currentDistrict,
      currentDepartment: details.currentDepartment,
      dniMatchesAddress: details.dniMatchesAddress,
      travelTimeToHospital: details.travelTimeToHospital,
      emergencyContactName: details.emergencyContactName,
      emergencyContactPhone: details.emergencyContactPhone,
      zoneType: details.zoneType,
      emergencyContactGender: details.emergencyContactGender,
      educationLevel: details.educationLevel,
      nativeLanguage: details.nativeLanguage,
      requiresTranslation: details.requiresTranslation,
      createdAt: details.createdAt.toISOString(),
      updatedAt: details.updatedAt.toISOString(),
    };
  }
}

export class PatientResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ format: 'email', nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  dni!: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  birthDate!: string | null;

  @ApiProperty({ nullable: true })
  gender!: string | null;

  @ApiProperty()
  primaryPhone!: string;

  @ApiProperty({ nullable: true })
  secondaryPhone!: string | null;

  @ApiProperty()
  hasWhatsapp!: boolean;

  @ApiProperty({ enum: PatientRole })
  role!: PatientRole;

  @ApiProperty({ enum: PatientStatus })
  status!: PatientStatus;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ enum: DeactivationReason, nullable: true })
  deactivationReason!: DeactivationReason | null;

  @ApiProperty({ nullable: true })
  deactivationReasonDetail!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  deactivatedAt!: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  deceasedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(patient: Patient): PatientResponseDto {
    return {
      id: patient.id,
      fullName: patient.fullName,
      email: patient.email,
      dni: patient.dni,
      birthDate: patient.birthDate,
      gender: patient.gender,
      primaryPhone: patient.primaryPhone,
      secondaryPhone: patient.secondaryPhone,
      hasWhatsapp: patient.hasWhatsapp,
      role: patient.role,
      status: patient.status,
      isActive: patient.isActive,
      deactivationReason: patient.deactivationReason,
      deactivationReasonDetail: patient.deactivationReasonDetail,
      deactivatedAt: patient.deactivatedAt?.toISOString() ?? null,
      deceasedAt: patient.deceasedAt,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
    };
  }
}

export class PatientDetailsWithSummaryResponseDto extends PatientResponseDto {
  @ApiProperty({ type: PatientDetailsResponseDto, nullable: true })
  details!: PatientDetailsResponseDto | null;

  @ApiProperty({ nullable: true })
  summary!: string | null;

  static from(
    patient: Patient & { summary: string | null },
  ): PatientDetailsWithSummaryResponseDto {
    return {
      ...PatientResponseDto.from(patient),
      details: patient.details
        ? PatientDetailsResponseDto.from(patient.details)
        : null,
      summary: patient.summary,
    };
  }
}

export class PatientListResponseDto {
  @ApiProperty({ type: PatientResponseDto, isArray: true })
  data!: PatientResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  static from(result: {
    data: Patient[];
    total: number;
  }): PatientListResponseDto {
    return {
      data: result.data.map((patient) => PatientResponseDto.from(patient)),
      total: result.total,
    };
  }
}

export class CompanionPatientResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companionId!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty()
  isPrimaryInformant!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({ type: PatientResponseDto })
  companion?: PatientResponseDto;

  @ApiPropertyOptional({ type: PatientResponseDto })
  patient?: PatientResponseDto;

  static from(link: CompanionPatient): CompanionPatientResponseDto {
    return {
      id: link.id,
      companionId: link.companionId,
      patientId: link.patientId,
      isPrimaryInformant: link.isPrimaryInformant,
      createdAt: link.createdAt.toISOString(),
      ...(link.companion
        ? { companion: PatientResponseDto.from(link.companion) }
        : {}),
      ...(link.patient
        ? { patient: PatientResponseDto.from(link.patient) }
        : {}),
    };
  }
}

export class PatientSummaryResponseDto {
  @ApiProperty({ enum: PatientSummaryStatus })
  status!: PatientSummaryStatus;

  @ApiProperty({ nullable: true })
  summary!: string | null;

  @ApiProperty({ nullable: true })
  model!: string | null;

  @ApiProperty({ enum: ['ON_DEMAND', 'STORED', 'PENDING'] })
  source!: 'ON_DEMAND' | 'STORED' | 'PENDING';

  static from(summary: {
    status: PatientSummaryStatus;
    summary: string | null;
    model: string | null;
    source: string;
  }): PatientSummaryResponseDto {
    return {
      status: summary.status,
      summary: summary.summary,
      model: summary.model,
      source: summary.source as PatientSummaryResponseDto['source'],
    };
  }
}
