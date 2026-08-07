import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reminder } from '../database/entities/reminder.entity';
import { Agent } from '../database/entities/agent.entity';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Patient } from '../database/entities/patient.entity';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { PatientAccessModule } from '../patient-access/patient-access.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Reminder, Agent, FollowUp, Patient]),
    PatientAccessModule,
  ],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
