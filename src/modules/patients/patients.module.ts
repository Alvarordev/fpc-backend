import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PatientSummary } from '../../database/entities/patient-summary.entity';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { PatientAccessModule } from './access/patient-access.module';
import { N8nModule } from '../../integrations/n8n/n8n.module';
import { PatientDiagnosesController } from './clinical/diagnoses/patient-diagnoses.controller';
import { PatientDiagnosesService } from './clinical/diagnoses/patient-diagnoses.service';
import { PatientInsuranceController } from './clinical/insurance/patient-insurance.controller';
import { PatientInsuranceService } from './clinical/insurance/patient-insurance.service';
import { PatientMedicalAppointmentsController } from './clinical/medical-appointments/patient-medical-appointments.controller';
import { PatientMedicalAppointmentsService } from './clinical/medical-appointments/patient-medical-appointments.service';
import { PatientSisAffiliationController } from './clinical/sis-affiliation/patient-sis-affiliation.controller';
import { PatientSisAffiliationService } from './clinical/sis-affiliation/patient-sis-affiliation.service';
import { PatientTreatmentsController } from './clinical/treatments/patient-treatments.controller';
import { PatientTreatmentsService } from './clinical/treatments/patient-treatments.service';
import { PatientAddressesController } from './addresses/patient-addresses.controller';
import { PatientAddressesService } from './addresses/patient-addresses.service';
import { TreatmentMedicationsController } from './clinical/treatments/medications/treatment-medications.controller';
import { TreatmentMedicationsService } from './clinical/treatments/medications/treatment-medications.service';
import { CompanionPatient } from '../../database/entities/companion-patient.entity';
import { PatientAddress } from '../../database/entities/patient-address.entity';
import { TreatmentMedication } from '../../database/entities/treatment-medication.entity';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { PatientDetails } from '../../database/entities/patient-details.entity';
import { PatientHealthPhaseHistory } from '../../database/entities/patient-health-phase-history.entity';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../../database/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import { PatientSisAffiliation } from '../../database/entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from '../../database/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../database/entities/patient-treatment.entity';
import { Patient } from '../../database/entities/patient.entity';
import { HistoryVersioningService } from './history-versioning/history-versioning.service';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientSymptomReportsController } from './symptom-reports/patient-symptom-reports.controller';
import { PatientSymptomReportsService } from './symptom-reports/patient-symptom-reports.service';
import { PatientTimelineService } from './patient-timeline.service';
import { PatientSocialNote } from '../../database/entities/patient-social-note.entity';
import { PatientSocialNotesController } from './social-notes/patient-social-notes.controller';
import { PatientSocialNotesService } from './social-notes/patient-social-notes.service';
import {
  PatientActiveComorbidity,
  PatientFamilyCancerHistory,
  PatientHealthBackgroundAssessment,
  PatientLimitation,
} from '../../database/entities/patient-health-background-assessment.entity';
import { PatientHealthBackgroundAssessmentsController } from './clinical/health-background/patient-health-background-assessments.controller';
import { PatientHealthBackgroundAssessmentsService } from './clinical/health-background/patient-health-background-assessments.service';
import { PatientDiagnosticStatusEvent } from '../../database/entities/patient-diagnostic-status-event.entity';
import { PatientDiagnosticStatusesController } from './diagnostic-status/patient-diagnostic-statuses.controller';
import { PatientDiagnosticStatusesService } from './diagnostic-status/patient-diagnostic-statuses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientDetails,
      PatientHealthPhaseHistory,
      PatientAddress,
      CompanionPatient,
      PatientDiagnosis,
      PatientInsurance,
      PatientMedicalAppointment,
      PatientSisAffiliation,
      PatientTreatment,
      PatientSymptomReport,
      TreatmentMedication,
      HealthCenter,
      FollowUp,
      Enrollment,
      PatientSummary,
      PatientSocialNote,
      PatientHealthBackgroundAssessment,
      PatientActiveComorbidity,
      PatientLimitation,
      PatientFamilyCancerHistory,
      PatientDiagnosticStatusEvent,
    ]),
    PatientSummariesModule,
    PatientAccessModule,
    N8nModule,
  ],
  controllers: [
    PatientsController,
    PatientDiagnosesController,
    PatientInsuranceController,
    PatientMedicalAppointmentsController,
    PatientSisAffiliationController,
    PatientTreatmentsController,
    PatientSymptomReportsController,
    PatientAddressesController,
    TreatmentMedicationsController,
    PatientSocialNotesController,
    PatientHealthBackgroundAssessmentsController,
    PatientDiagnosticStatusesController,
  ],
  providers: [
    PatientsService,
    HistoryVersioningService,
    PatientDiagnosesService,
    PatientInsuranceService,
    PatientMedicalAppointmentsService,
    PatientSisAffiliationService,
    PatientTreatmentsService,
    PatientSymptomReportsService,
    PatientTimelineService,
    PatientAddressesService,
    TreatmentMedicationsService,
    PatientSocialNotesService,
    PatientHealthBackgroundAssessmentsService,
    PatientDiagnosticStatusesService,
  ],
  exports: [
    PatientsService,
    HistoryVersioningService,
    PatientDiagnosesService,
    PatientInsuranceService,
    PatientMedicalAppointmentsService,
    PatientSisAffiliationService,
    PatientTreatmentsService,
    PatientSymptomReportsService,
    PatientAddressesService,
    TreatmentMedicationsService,
    PatientSocialNotesService,
    PatientHealthBackgroundAssessmentsService,
    PatientDiagnosticStatusesService,
  ],
})
export class PatientsModule {}
