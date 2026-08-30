import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../../database/entities/agent.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { RemindersModule } from '../reminders/reminders.module';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';
import { PatientAccessModule } from '../patients/access/patient-access.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FollowUp, Patient, Agent]),
    PatientSummariesModule,
    PatientAccessModule,
    forwardRef(() => RemindersModule),
  ],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
