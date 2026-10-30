import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../../database/entities/agent.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { CallCenterController } from './call-center.controller';
import { CallCenterService } from './call-center.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, FollowUp, Reminder, Patient]),
    PatientSummariesModule,
  ],
  controllers: [CallCenterController],
  providers: [CallCenterService],
  exports: [CallCenterService],
})
export class CallCenterModule {}
