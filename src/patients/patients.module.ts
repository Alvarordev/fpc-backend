import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../database/entities/enrollment.entity';
import { FollowUp } from '../database/entities/follow-up.entity';
import { PatientSummary } from '../database/entities/patient-summary.entity';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { PatientAccessModule } from '../patient-access/patient-access.module';
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
import { CompanionPatient } from './entities/companion-patient.entity';
import { PatientDetails } from './entities/patient-details.entity';
import { PatientDiagnosis } from './entities/patient-diagnosis.entity';
import { PatientInsurance } from './entities/patient-insurance.entity';
import { PatientMedicalAppointment } from './entities/patient-medical-appointment.entity';
import { PatientSisAffiliation } from './entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from './entities/patient-symptom-report.entity';
import { PatientTreatment } from './entities/patient-treatment.entity';
import { Patient } from './entities/patient.entity';
import { HistoryVersioningService } from './history-versioning/history-versioning.service';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientSymptomReportsController } from './symptom-reports/patient-symptom-reports.controller';
import { PatientSymptomReportsService } from './symptom-reports/patient-symptom-reports.service';
import { PatientTimelineService } from './patient-timeline.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientDetails,
      CompanionPatient,
      PatientDiagnosis,
      PatientInsurance,
      PatientMedicalAppointment,
      PatientSisAffiliation,
      PatientTreatment,
      PatientSymptomReport,
      FollowUp,
      Enrollment,
      PatientSummary,
    ]),
    PatientSummariesModule,
    PatientAccessModule,
  ],
  controllers: [
    PatientsController,
    PatientDiagnosesController,
    PatientInsuranceController,
    PatientMedicalAppointmentsController,
    PatientSisAffiliationController,
    PatientTreatmentsController,
    PatientSymptomReportsController,
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
  ],
  exports: [
    PatientsService,
    PatientDiagnosesService,
    PatientInsuranceService,
    PatientMedicalAppointmentsService,
    PatientSisAffiliationService,
    PatientTreatmentsService,
    PatientSymptomReportsService,
  ],
})
export class PatientsModule {}
