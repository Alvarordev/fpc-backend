import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../database/entities/enrollment.entity';
import { InteractionsModule } from '../interactions/interactions.module';
import { PatientsModule } from '../patients/patients.module';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enrollment]),
    PatientsModule,
    PatientSummariesModule,
    InteractionsModule,
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
})
export class EnrollmentsModule {}
