import { Module } from '@nestjs/common';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { PatientsModule } from '../patients/patients.module';
import { RecordDeletionsController } from './record-deletions.controller';
import { RecordDeletionsService } from './record-deletions.service';

@Module({
  imports: [PatientsModule, PatientSummariesModule],
  controllers: [RecordDeletionsController],
  providers: [RecordDeletionsService],
})
export class RecordDeletionsModule {}
