import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../database/entities/enrollment.entity';
import { InteractionsModule } from '../interactions/interactions.module';
import { PatientDiagnosesModule } from '../patient-diagnoses/patient-diagnoses.module';
import { PatientInsuranceModule } from '../patient-insurance/patient-insurance.module';
import { PatientMedicalAppointmentsModule } from '../patient-medical-appointments/patient-medical-appointments.module';
import { PatientSisAffiliationModule } from '../patient-sis-affiliation/patient-sis-affiliation.module';
import { PatientTreatmentsModule } from '../patient-treatments/patient-treatments.module';
import { PatientSymptomReportsModule } from '../patient-symptom-reports/patient-symptom-reports.module';
import { PatientsModule } from '../patients/patients.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enrollment]),
    PatientsModule,
    InteractionsModule,
    PatientInsuranceModule,
    PatientDiagnosesModule,
    PatientTreatmentsModule,
    PatientMedicalAppointmentsModule,
    PatientSisAffiliationModule,
    PatientSymptomReportsModule,
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
})
export class EnrollmentsModule {}
