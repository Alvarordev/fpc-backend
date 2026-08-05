import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../database/entities/enrollment.entity';
import { EnrollmentFamilyTalkInterest } from '../database/entities/enrollment-family-talk-interest.entity';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { PatientsModule } from '../patients/patients.module';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enrollment, EnrollmentFamilyTalkInterest]),
    PatientsModule,
    PatientSummariesModule,
    FollowUpsModule,
    WebhooksModule,
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
})
export class EnrollmentsModule {}
