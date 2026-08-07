import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Patient } from '../database/entities/patient.entity';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { Reminder } from '../database/entities/reminder.entity';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';
import { PatientAccessModule } from '../patient-access/patient-access.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([FollowUp, Patient, Agent, Reminder]),
    PatientSummariesModule,
    PatientAccessModule,
  ],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
