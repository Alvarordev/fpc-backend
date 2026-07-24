import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interaction } from '../database/entities/interaction.entity';
import { PatientDiagnosis } from '../database/entities/patient-diagnosis.entity';
import { PatientTreatment } from '../database/entities/patient-treatment.entity';
import { PatientsModule } from '../patients/patients.module';
import { PatientTreatmentsController } from './patient-treatments.controller';
import { PatientTreatmentsService } from './patient-treatments.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([PatientTreatment, PatientDiagnosis, Interaction]),
    PatientsModule,
  ],
  controllers: [PatientTreatmentsController],
  providers: [PatientTreatmentsService],
})
export class PatientTreatmentsModule {}
