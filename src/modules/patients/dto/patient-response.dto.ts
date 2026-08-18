import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PatientSummaryStatus } from '../../../database/entities/patient-summary.entity';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { PatientDiagnosis } from '../../../database/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../../../database/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../../database/entities/patient-medical-appointment.entity';
import { PatientSisAffiliation } from '../../../database/entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from '../../../database/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../../database/entities/patient-treatment.entity';
import { PatientDiagnosisResponseDto } from '../clinical/diagnoses/dto/patient-diagnosis-response.dto';
import { PatientInsuranceResponseDto } from '../clinical/insurance/dto/patient-insurance-response.dto';
import { PatientMedicalAppointmentResponseDto } from '../clinical/medical-appointments/dto/patient-medical-appointment-response.dto';
import { PatientSisAffiliationResponseDto } from '../clinical/sis-affiliation/dto/patient-sis-affiliation-response.dto';
import { PatientTreatmentResponseDto } from '../clinical/treatments/dto/patient-treatment-response.dto';
import { PatientSymptomReportResponseDto } from '../symptom-reports/dto/patient-symptom-report-response.dto';
import { CompanionPatient } from '../../../database/entities/companion-patient.entity';
import { DeactivationReason } from '../../../database/entities/deactivation-reason.enum';
import { EducationLevel } from '../../../database/entities/education-level.enum';
import { PatientActivityStatus } from '../../../database/entities/patient-activity-status.enum';
import { PatientDetails } from '../../../database/entities/patient-details.entity';
import { PatientHealthPhase } from '../../../database/entities/patient-health-phase.enum';
import { PatientHealthPhaseHistory } from '../../../database/entities/patient-health-phase-history.entity';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientStatus } from '../../../database/entities/patient-status.enum';
import { Patient } from '../../../database/entities/patient.entity';
import { DurationResponseDto } from '../../../shared/duration/duration-response.dto';

export class PatientHealthPhaseHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: PatientHealthPhase })
  healthPhase!: PatientHealthPhase;

  @ApiProperty({ format: 'date-time' })
  changedAt!: string;

  static from(
    history: PatientHealthPhaseHistory,
  ): PatientHealthPhaseHistoryResponseDto {
    return {
      id: history.id,
      healthPhase: history.healthPhase,
      changedAt: history.changedAt.toISOString(),
    };
  }
}

export class PatientDetailsResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ enum: PatientHealthPhase, nullable: true })
  healthPhase!: PatientHealthPhase | null;

  @ApiProperty({ nullable: true })
  birthDepartment!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  primaryHealthCenterId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  primaryHealthCenterName?: string | null;

  @ApiProperty({ type: DurationResponseDto, nullable: true })
  travelTimeToHospital!: DurationResponseDto | null;

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

  @ApiProperty({ nullable: true })
  referredToSocialWorker!: boolean | null;

  @ApiProperty({ nullable: true })
  evidenceOfDomesticViolence!: boolean | null;

  @ApiProperty({ nullable: true })
  usesWoodStove!: boolean | null;

  @ApiProperty({ nullable: true })
  isWorking!: boolean | null;

  @ApiProperty({ nullable: true })
  receivesFinancialSupport!: boolean | null;

  @ApiProperty({ nullable: true })
  hasConadisCard!: boolean | null;

  @ApiProperty({ nullable: true })
  knowsAboutFissal!: boolean | null;

  @ApiProperty({ nullable: true })
  programDropoutReason!: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  programDropoutDate!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: PatientHealthPhaseHistoryResponseDto, isArray: true })
  healthPhaseHistory!: PatientHealthPhaseHistoryResponseDto[];

  static from(
    details: PatientDetails,
    healthPhaseHistory?: PatientHealthPhaseHistory[],
  ): PatientDetailsResponseDto {
    const history =
      healthPhaseHistory ??
      (
        details as PatientDetails & {
          healthPhaseHistory?: PatientHealthPhaseHistory[];
        }
      ).healthPhaseHistory ??
      [];

    return {
      id: details.id,
      patientId: details.patientId,
      healthPhase: details.healthPhase,
      birthDepartment: details.birthDepartment,
      primaryHealthCenterId: details.primaryHealthCenterId,
      primaryHealthCenterName: details.primaryHealthCenter?.name ?? null,
      travelTimeToHospital: DurationResponseDto.from(
        details.travelTimeToHospital,
      ),
      emergencyContactName: details.emergencyContactName,
      emergencyContactPhone: details.emergencyContactPhone,
      zoneType: details.zoneType,
      emergencyContactGender: details.emergencyContactGender,
      educationLevel: details.educationLevel,
      nativeLanguage: details.nativeLanguage,
      requiresTranslation: details.requiresTranslation,
      referredToSocialWorker: details.referredToSocialWorker,
      evidenceOfDomesticViolence: details.evidenceOfDomesticViolence,
      usesWoodStove: details.usesWoodStove,
      isWorking: details.isWorking,
      receivesFinancialSupport: details.receivesFinancialSupport,
      hasConadisCard: details.hasConadisCard,
      knowsAboutFissal: details.knowsAboutFissal,
      programDropoutReason: details.programDropoutReason,
      programDropoutDate: details.programDropoutDate,
      createdAt: details.createdAt.toISOString(),
      updatedAt: details.updatedAt.toISOString(),
      healthPhaseHistory: history.map((history) =>
        PatientHealthPhaseHistoryResponseDto.from(history),
      ),
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

  @ApiProperty({ enum: PatientActivityStatus })
  activityStatus!: PatientActivityStatus;

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
      activityStatus: patient.activityStatus,
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

  @ApiProperty({ type: PatientDiagnosisResponseDto, isArray: true })
  diagnoses!: PatientDiagnosisResponseDto[];

  @ApiProperty({ type: PatientTreatmentResponseDto, isArray: true })
  treatments!: PatientTreatmentResponseDto[];

  @ApiProperty({ type: PatientInsuranceResponseDto, isArray: true })
  insurance!: PatientInsuranceResponseDto[];

  @ApiProperty({ type: PatientMedicalAppointmentResponseDto, isArray: true })
  medicalAppointments!: PatientMedicalAppointmentResponseDto[];

  @ApiProperty({ type: PatientSisAffiliationResponseDto, isArray: true })
  sisAffiliations!: PatientSisAffiliationResponseDto[];

  @ApiProperty({ type: PatientSymptomReportResponseDto, isArray: true })
  symptomReports!: PatientSymptomReportResponseDto[];

  @ApiProperty({ type: () => CompanionPatientResponseDto, isArray: true })
  companions!: CompanionPatientResponseDto[];

  static from(
    patient: Patient & {
      summary: string | null;
      diagnoses: PatientDiagnosis[];
      treatments: PatientTreatment[];
      insurance: PatientInsurance[];
      medicalAppointments: PatientMedicalAppointment[];
      sisAffiliations: PatientSisAffiliation[];
      symptomReports: PatientSymptomReport[];
      companions: CompanionPatient[];
      healthPhaseHistory: PatientHealthPhaseHistory[];
    },
  ): PatientDetailsWithSummaryResponseDto {
    return {
      ...PatientResponseDto.from(patient),
      details: patient.details
        ? PatientDetailsResponseDto.from(
            patient.details,
            patient.healthPhaseHistory,
          )
        : null,
      summary: patient.summary,
      diagnoses: patient.diagnoses.map((diagnosis) =>
        PatientDiagnosisResponseDto.from(diagnosis),
      ),
      treatments: patient.treatments.map((treatment) =>
        PatientTreatmentResponseDto.from(treatment),
      ),
      insurance: patient.insurance.map((item) =>
        PatientInsuranceResponseDto.from(item),
      ),
      medicalAppointments: patient.medicalAppointments.map((appointment) =>
        PatientMedicalAppointmentResponseDto.from(appointment),
      ),
      sisAffiliations: patient.sisAffiliations.map((affiliation) =>
        PatientSisAffiliationResponseDto.from(affiliation),
      ),
      symptomReports: patient.symptomReports.map((report) =>
        PatientSymptomReportResponseDto.from(report),
      ),
      companions: patient.companions.map((companion) =>
        CompanionPatientResponseDto.from(companion),
      ),
    };
  }
}

export class CurrentDiagnosisResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  diagnosis!: string;

  @ApiProperty({ nullable: true })
  cancerStage!: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  diagnosisDate!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  healthCenterId!: string | null;

  @ApiProperty({ nullable: true })
  healthCenterName!: string | null;

  static from(diagnosis: PatientDiagnosis): CurrentDiagnosisResponseDto {
    return {
      id: diagnosis.id,
      diagnosis: diagnosis.diagnosis,
      cancerStage: diagnosis.cancerStage,
      diagnosisDate: diagnosis.diagnosisDate,
      healthCenterId: diagnosis.healthCenterId,
      healthCenterName: diagnosis.healthCenter?.name ?? null,
    };
  }
}

export class LatestFollowUpResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  purpose!: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  scheduledAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  completedAt!: string | null;

  static from(followUp: FollowUp): LatestFollowUpResponseDto {
    const occurredAt =
      followUp.completedAt ?? followUp.scheduledAt ?? followUp.createdAt;
    return {
      id: followUp.id,
      type: followUp.type,
      status: followUp.status,
      purpose: followUp.purpose,
      occurredAt: occurredAt.toISOString(),
      scheduledAt: followUp.scheduledAt?.toISOString() ?? null,
      completedAt: followUp.completedAt?.toISOString() ?? null,
    };
  }
}

export class PatientListItemResponseDto extends PatientResponseDto {
  @ApiProperty({ type: CurrentDiagnosisResponseDto, nullable: true })
  currentDiagnosis!: CurrentDiagnosisResponseDto | null;

  @ApiProperty({ nullable: true })
  currentDepartment!: string | null;

  @ApiProperty({ type: LatestFollowUpResponseDto, nullable: true })
  latestFollowUp!: LatestFollowUpResponseDto | null;

  static from(
    patient: Patient & {
      currentDiagnosis: PatientDiagnosis | null;
      currentDepartment: string | null;
      latestFollowUp: FollowUp | null;
    },
  ): PatientListItemResponseDto {
    return {
      ...PatientResponseDto.from(patient),
      currentDiagnosis: patient.currentDiagnosis
        ? CurrentDiagnosisResponseDto.from(patient.currentDiagnosis)
        : null,
      currentDepartment: patient.currentDepartment,
      latestFollowUp: patient.latestFollowUp
        ? LatestFollowUpResponseDto.from(patient.latestFollowUp)
        : null,
    };
  }
}

export class PatientListResponseDto {
  @ApiProperty({ type: PatientListItemResponseDto, isArray: true })
  data!: PatientListItemResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  static from(result: {
    data: Array<
      Patient & {
        currentDiagnosis: PatientDiagnosis | null;
        currentDepartment: string | null;
        latestFollowUp: FollowUp | null;
      }
    >;
    total: number;
  }): PatientListResponseDto {
    return {
      data: result.data.map((patient) =>
        PatientListItemResponseDto.from(patient),
      ),
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

  @ApiProperty({ nullable: true })
  relationship!: string | null;

  @ApiProperty({ nullable: true })
  companionDisplayName!: string | null;

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
      relationship: link.relationship ?? null,
      companionDisplayName: link.companion?.fullName ?? null,
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
