import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AgentsController } from '../agents/agents.controller';
import { AgentsService } from '../agents/agents.service';
import { AlertsController } from '../alerts/alerts.controller';
import { AlertsService } from '../alerts/alerts.service';
import { CallCenterController } from '../call-center/call-center.controller';
import { CallCenterService } from '../call-center/call-center.service';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { EnrollmentsController } from '../enrollments/enrollments.controller';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { FollowUpsController } from '../follow-ups/follow-ups.controller';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { HealthCentersController } from '../health-centers/health-centers.controller';
import { HealthCentersService } from '../health-centers/health-centers.service';
import { HealthController } from '../health/health.controller';
import { PatientSummaryOnDemandService } from '../patient-summaries/patient-summary-on-demand.service';
import { PatientDiagnosesController } from '../patients/clinical/diagnoses/patient-diagnoses.controller';
import { PatientDiagnosesService } from '../patients/clinical/diagnoses/patient-diagnoses.service';
import { PatientInsuranceController } from '../patients/clinical/insurance/patient-insurance.controller';
import { PatientInsuranceService } from '../patients/clinical/insurance/patient-insurance.service';
import { PatientMedicalAppointmentsController } from '../patients/clinical/medical-appointments/patient-medical-appointments.controller';
import { PatientMedicalAppointmentsService } from '../patients/clinical/medical-appointments/patient-medical-appointments.service';
import { PatientSisAffiliationController } from '../patients/clinical/sis-affiliation/patient-sis-affiliation.controller';
import { PatientSisAffiliationService } from '../patients/clinical/sis-affiliation/patient-sis-affiliation.service';
import { PatientTreatmentsController } from '../patients/clinical/treatments/patient-treatments.controller';
import { PatientTreatmentsService } from '../patients/clinical/treatments/patient-treatments.service';
import { PatientsController } from '../patients/patients.controller';
import { PatientsService } from '../patients/patients.service';
import { PatientTimelineService } from '../patients/patient-timeline.service';
import { PatientSymptomReportsController } from '../patients/symptom-reports/patient-symptom-reports.controller';
import { PatientSymptomReportsService } from '../patients/symptom-reports/patient-symptom-reports.service';
import { PsychooncologyAppointmentsController } from '../psychooncology-appointments/psychooncology-appointments.controller';
import { PsychooncologyAppointmentsService } from '../psychooncology-appointments/psychooncology-appointments.service';
import { RemindersController } from '../reminders/reminders.controller';
import { RemindersService } from '../reminders/reminders.service';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import { VolunteerAvailabilityController } from '../volunteer-availability/volunteer-availability.controller';
import { VolunteerAvailabilityService } from '../volunteer-availability/volunteer-availability.service';
import { VolunteersController } from '../volunteers/volunteers.controller';
import { VolunteersService } from '../volunteers/volunteers.service';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

// Controllers only need their route metadata to build the OpenAPI document.
// Empty providers keep generation independent from infrastructure services.
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [
    AlertsController,
    CallCenterController,
    AgentsController,
    AuthController,
    EnrollmentsController,
    FollowUpsController,
    HealthCentersController,
    HealthController,
    PatientsController,
    PatientDiagnosesController,
    PatientInsuranceController,
    PatientMedicalAppointmentsController,
    PatientSisAffiliationController,
    PatientTreatmentsController,
    PatientSymptomReportsController,
    PsychooncologyAppointmentsController,
    RemindersController,
    UsersController,
    VolunteerAvailabilityController,
    VolunteersController,
  ],
  providers: [
    { provide: AgentsService, useValue: {} },
    { provide: AlertsService, useValue: {} },
    { provide: CallCenterService, useValue: {} },
    { provide: AuthService, useValue: {} },
    { provide: EnrollmentsService, useValue: {} },
    { provide: FollowUpsService, useValue: {} },
    { provide: HealthCentersService, useValue: {} },
    { provide: HealthCheckService, useValue: {} },
    { provide: UsersService, useValue: {} },
    { provide: PatientsService, useValue: {} },
    { provide: PatientTimelineService, useValue: {} },
    { provide: PatientDiagnosesService, useValue: {} },
    { provide: PatientInsuranceService, useValue: {} },
    { provide: PatientMedicalAppointmentsService, useValue: {} },
    { provide: PatientSisAffiliationService, useValue: {} },
    { provide: PatientSymptomReportsService, useValue: {} },
    { provide: PatientTreatmentsService, useValue: {} },
    { provide: PatientSummaryOnDemandService, useValue: {} },
    { provide: PsychooncologyAppointmentsService, useValue: {} },
    { provide: RemindersService, useValue: {} },
    { provide: TypeOrmHealthIndicator, useValue: {} },
    { provide: VolunteerAvailabilityService, useValue: {} },
    { provide: VolunteersService, useValue: {} },
  ],
})
export class OpenApiModule {}
