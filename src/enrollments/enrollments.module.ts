import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../database/entities/enrollment.entity';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { PatientsModule } from '../patients/patients.module';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enrollment]),
    PatientsModule,
    PatientSummariesModule,
    FollowUpsModule,
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
})
export class EnrollmentsModule {}
