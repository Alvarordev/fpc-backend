import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Reminder } from '../database/entities/reminder.entity';
import { Patient } from '../patients/entities/patient.entity';
import { CallCenterController } from './call-center.controller';
import { CallCenterService } from './call-center.service';

@Module({
  imports: [TypeOrmModule.forFeature([Agent, FollowUp, Reminder, Patient])],
  controllers: [CallCenterController],
  providers: [CallCenterService],
})
export class CallCenterModule {}
