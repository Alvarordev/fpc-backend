import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { EnrollmentFamilyTalkInterest } from '../../database/entities/enrollment-family-talk-interest.entity';
import { Agent } from '../../database/entities/agent.entity';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { PatientsModule } from '../patients/patients.module';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { N8nModule } from '../../integrations/n8n/n8n.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enrollment, EnrollmentFamilyTalkInterest, Agent]),
    PatientsModule,
    PatientSummariesModule,
    FollowUpsModule,
    N8nModule,
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
})
export class EnrollmentsModule {}
