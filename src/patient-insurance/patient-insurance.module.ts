import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interaction } from '../database/entities/interaction.entity';
import { PatientInsurance } from '../database/entities/patient-insurance.entity';
import { PatientsModule } from '../patients/patients.module';
import { PatientInsuranceController } from './patient-insurance.controller';
import { PatientInsuranceService } from './patient-insurance.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([PatientInsurance, Interaction]),
    PatientsModule,
  ],
  controllers: [PatientInsuranceController],
  providers: [PatientInsuranceService],
  exports: [PatientInsuranceService],
})
export class PatientInsuranceModule {}
