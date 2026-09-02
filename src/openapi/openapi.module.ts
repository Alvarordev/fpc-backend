import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AgentsController } from '../modules/agents/agents.controller';
import { AgentsService } from '../modules/agents/agents.service';
import { FoundationsController } from '../modules/foundations/foundations.controller';
import { FoundationsService } from '../modules/foundations/foundations.service';
import { AlertsController } from '../modules/alerts/alerts.controller';
import { AlertsService } from '../modules/alerts/alerts.service';
import { AlertSummaryService } from '../modules/alerts/alert-summary.service';
import { CallCenterController } from '../modules/call-center/call-center.controller';
import { CallCenterService } from '../modules/call-center/call-center.service';
import { DashboardController } from '../modules/dashboard/dashboard.controller';
import { DashboardIndicatorsService } from '../modules/dashboard/dashboard-indicators.service';
import { DashboardService } from '../modules/dashboard/dashboard.service';
import { AuthController } from '../modules/auth/auth.controller';
import { AuthService } from '../modules/auth/auth.service';
import { EnrollmentsController } from '../modules/enrollments/enrollments.controller';
import { FamilyTalkInterestsController } from '../modules/enrollments/family-talk-interests.controller';
import { EnrollmentsService } from '../modules/enrollments/enrollments.service';
import { FollowUpsController } from '../modules/follow-ups/follow-ups.controller';
import { FollowUpsService } from '../modules/follow-ups/follow-ups.service';
import { HealthCentersController } from '../modules/health-centers/health-centers.controller';
import { HealthCentersService } from '../modules/health-centers/health-centers.service';
import { HealthController } from '../modules/health/health.controller';
import { MedicalAppointmentsController } from '../modules/patients/clinical/medical-appointments/medical-appointments.controller';
import { MedicalAppointmentsService } from '../modules/patients/clinical/medical-appointments/medical-appointments.service';
import { PatientSummaryOnDemandService } from '../modules/patient-summaries/patient-summary-on-demand.service';
import { PatientDiagnosesController } from '../modules/patients/clinical/diagnoses/patient-diagnoses.controller';
import { PatientDiagnosesService } from '../modules/patients/clinical/diagnoses/patient-diagnoses.service';
import { PatientInsuranceController } from '../modules/patients/clinical/insurance/patient-insurance.controller';
import { PatientInsuranceService } from '../modules/patients/clinical/insurance/patient-insurance.service';
import { PatientMedicalAppointmentsController } from '../modules/patients/clinical/medical-appointments/patient-medical-appointments.controller';
import { PatientMedicalAppointmentsService } from '../modules/patients/clinical/medical-appointments/patient-medical-appointments.service';
import { PatientSisAffiliationController } from '../modules/patients/clinical/sis-affiliation/patient-sis-affiliation.controller';
import { PatientSisAffiliationService } from '../modules/patients/clinical/sis-affiliation/patient-sis-affiliation.service';
import { PatientTreatmentsController } from '../modules/patients/clinical/treatments/patient-treatments.controller';
import { PatientTreatmentsService } from '../modules/patients/clinical/treatments/patient-treatments.service';
import { TreatmentMedicationsController } from '../modules/patients/clinical/treatments/medications/treatment-medications.controller';
import { TreatmentMedicationsService } from '../modules/patients/clinical/treatments/medications/treatment-medications.service';
import { PatientAddressesController } from '../modules/patients/addresses/patient-addresses.controller';
import { PatientAddressesService } from '../modules/patients/addresses/patient-addresses.service';
import { PatientsController } from '../modules/patients/patients.controller';
import { PatientsService } from '../modules/patients/patients.service';
import { PatientTimelineService } from '../modules/patients/patient-timeline.service';
import { PatientSymptomReportsController } from '../modules/patients/symptom-reports/patient-symptom-reports.controller';
import { PatientSymptomReportsService } from '../modules/patients/symptom-reports/patient-symptom-reports.service';
import { PatientSocialNotesController } from '../modules/patients/social-notes/patient-social-notes.controller';
import { PatientSocialNotesService } from '../modules/patients/social-notes/patient-social-notes.service';
import { PatientHealthBackgroundAssessmentsController } from '../modules/patients/clinical/health-background/patient-health-background-assessments.controller';
import { PatientHealthBackgroundAssessmentsService } from '../modules/patients/clinical/health-background/patient-health-background-assessments.service';
import { PatientDiagnosticStatusesController } from '../modules/patients/diagnostic-status/patient-diagnostic-statuses.controller';
import { PatientDiagnosticStatusesService } from '../modules/patients/diagnostic-status/patient-diagnostic-statuses.service';
import { PsychooncologyAppointmentsController } from '../modules/psychooncology-appointments/psychooncology-appointments.controller';
import { PsychooncologyAppointmentsService } from '../modules/psychooncology-appointments/psychooncology-appointments.service';
import { RemindersController } from '../modules/reminders/reminders.controller';
import { RemindersService } from '../modules/reminders/reminders.service';
import { UsersController } from '../modules/users/users.controller';
import { UsersService } from '../modules/users/users.service';
import { VolunteerAvailabilityController } from '../modules/volunteers/availability/volunteer-availability.controller';
import { VolunteerAvailabilityService } from '../modules/volunteers/availability/volunteer-availability.service';
import { VolunteersController } from '../modules/volunteers/volunteers.controller';
import { VolunteersService } from '../modules/volunteers/volunteers.service';
import { VolunteerCalendarController } from '../modules/volunteers/calendar/volunteer-calendar.controller';
import { VolunteerCalendarService } from '../modules/volunteers/calendar/volunteer-calendar.service';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { PatientDocumentsController } from '../modules/patients/documents/patient-documents.controller';
import { PatientDocumentsService } from '../modules/patients/documents/patient-documents.service';
import { PatientPsychooncologySupportAssessmentsController } from '../modules/patients/clinical/psychooncology-support/patient-psychooncology-support-assessments.controller';
import { PatientPsychooncologySupportAssessmentsService } from '../modules/patients/clinical/psychooncology-support/patient-psychooncology-support-assessments.service';
import { HistoricalRecordsController } from '../modules/historical-records/historical-records.controller';
import { HistoricalRecordsService } from '../modules/historical-records/historical-records.service';

// Controllers only need their route metadata to build the OpenAPI document.
// Empty providers keep generation independent from infrastructure services.
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [
    AlertsController,
    CallCenterController,
    DashboardController,
    AgentsController,
    FoundationsController,
    AuthController,
    EnrollmentsController,
    FamilyTalkInterestsController,
    FollowUpsController,
    HealthCentersController,
    HealthController,
    MedicalAppointmentsController,
    PatientsController,
    PatientDiagnosesController,
    PatientInsuranceController,
    PatientMedicalAppointmentsController,
    PatientSisAffiliationController,
    PatientTreatmentsController,
    TreatmentMedicationsController,
    PatientAddressesController,
    PatientSymptomReportsController,
    PatientSocialNotesController,
    PatientHealthBackgroundAssessmentsController,
    PatientDiagnosticStatusesController,
    PatientDocumentsController,
    PatientPsychooncologySupportAssessmentsController,
    PsychooncologyAppointmentsController,
    RemindersController,
    UsersController,
    VolunteerAvailabilityController,
    VolunteersController,
    VolunteerCalendarController,
    HistoricalRecordsController,
  ],
  providers: [
    { provide: AgentsService, useValue: {} },
    { provide: FoundationsService, useValue: {} },
    { provide: AlertsService, useValue: {} },
    { provide: AlertSummaryService, useValue: {} },
    { provide: CallCenterService, useValue: {} },
    { provide: DashboardService, useValue: {} },
    { provide: DashboardIndicatorsService, useValue: {} },
    { provide: AuthService, useValue: {} },
    { provide: EnrollmentsService, useValue: {} },
    { provide: FollowUpsService, useValue: {} },
    { provide: HealthCentersService, useValue: {} },
    { provide: HealthCheckService, useValue: {} },
    { provide: MedicalAppointmentsService, useValue: {} },
    { provide: UsersService, useValue: {} },
    { provide: PatientsService, useValue: {} },
    { provide: PatientTimelineService, useValue: {} },
    { provide: PatientDiagnosesService, useValue: {} },
    { provide: PatientInsuranceService, useValue: {} },
    { provide: PatientMedicalAppointmentsService, useValue: {} },
    { provide: PatientSisAffiliationService, useValue: {} },
    { provide: PatientSymptomReportsService, useValue: {} },
    { provide: PatientSocialNotesService, useValue: {} },
    { provide: PatientHealthBackgroundAssessmentsService, useValue: {} },
    { provide: PatientDiagnosticStatusesService, useValue: {} },
    { provide: PatientDocumentsService, useValue: {} },
    { provide: PatientPsychooncologySupportAssessmentsService, useValue: {} },
    { provide: PatientTreatmentsService, useValue: {} },
    { provide: TreatmentMedicationsService, useValue: {} },
    { provide: PatientAddressesService, useValue: {} },
    { provide: PatientSummaryOnDemandService, useValue: {} },
    { provide: PsychooncologyAppointmentsService, useValue: {} },
    { provide: RemindersService, useValue: {} },
    { provide: TypeOrmHealthIndicator, useValue: {} },
    { provide: VolunteerAvailabilityService, useValue: {} },
    { provide: VolunteersService, useValue: {} },
    { provide: VolunteerCalendarService, useValue: {} },
    { provide: HistoricalRecordsService, useValue: {} },
  ],
})
export class OpenApiModule {}
