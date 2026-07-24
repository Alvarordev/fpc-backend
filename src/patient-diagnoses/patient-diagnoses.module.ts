import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interaction } from '../database/entities/interaction.entity';
import { PatientDiagnosis } from '../database/entities/patient-diagnosis.entity';
import { PatientsModule } from '../patients/patients.module';
import { PatientDiagnosesController } from './patient-diagnoses.controller';
import { PatientDiagnosesService } from './patient-diagnoses.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([PatientDiagnosis, Interaction]),
    PatientsModule,
  ],
  controllers: [PatientDiagnosesController],
  providers: [PatientDiagnosesService],
  exports: [PatientDiagnosesService],
})
export class PatientDiagnosesModule {}
