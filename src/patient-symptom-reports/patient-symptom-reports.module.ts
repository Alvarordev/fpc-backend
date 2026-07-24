import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../database/entities/enrollment.entity';
import { Interaction } from '../database/entities/interaction.entity';
import { PatientSymptomReport } from '../database/entities/patient-symptom-report.entity';
import { PatientsModule } from '../patients/patients.module';
import { PatientSymptomReportsController } from './patient-symptom-reports.controller';
import { PatientSymptomReportsService } from './patient-symptom-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatientSymptomReport, Interaction, Enrollment]),
    PatientsModule,
  ],
  controllers: [PatientSymptomReportsController],
  providers: [PatientSymptomReportsService],
  exports: [PatientSymptomReportsService],
})
export class PatientSymptomReportsModule {}
