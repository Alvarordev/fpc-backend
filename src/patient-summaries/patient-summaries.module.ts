import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../database/entities/enrollment.entity';
import { Interaction } from '../database/entities/interaction.entity';
import { PatientSummaryRateLimit } from '../database/entities/patient-summary-rate-limit.entity';
import { PatientSummary } from '../database/entities/patient-summary.entity';
import { PatientDiagnosis } from '../patients/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../patients/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../patients/entities/patient-medical-appointment.entity';
import { PatientSisAffiliation } from '../patients/entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from '../patients/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../patients/entities/patient-treatment.entity';
import { Patient } from '../patients/entities/patient.entity';
import { GeminiSummaryClient } from './gemini-summary.client';
import { PatientSummaryPayloadService } from './patient-summary-payload.service';
import { PatientSummaryRateLimiterService } from './patient-summary-rate-limiter.service';
import { PatientSummaryScheduler } from './patient-summary.scheduler';
import { PatientSummaryStateService } from './patient-summary-state.service';
import { PatientSummaryWorkerService } from './patient-summary-worker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientSummary,
      PatientSummaryRateLimit,
      Patient,
      PatientDiagnosis,
      PatientInsurance,
      PatientTreatment,
      PatientMedicalAppointment,
      PatientSisAffiliation,
      PatientSymptomReport,
      Enrollment,
      Interaction,
    ]),
  ],
  providers: [
    GeminiSummaryClient,
    PatientSummaryPayloadService,
    PatientSummaryRateLimiterService,
    PatientSummaryStateService,
    PatientSummaryWorkerService,
    PatientSummaryScheduler,
  ],
})
export class PatientSummariesModule {}
