import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interaction } from '../database/entities/interaction.entity';
import { PatientSisAffiliation } from '../database/entities/patient-sis-affiliation.entity';
import { PatientsModule } from '../patients/patients.module';
import { PatientSisAffiliationController } from './patient-sis-affiliation.controller';
import { PatientSisAffiliationService } from './patient-sis-affiliation.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([PatientSisAffiliation, Interaction]),
    PatientsModule,
  ],
  controllers: [PatientSisAffiliationController],
  providers: [PatientSisAffiliationService],
})
export class PatientSisAffiliationModule {}
