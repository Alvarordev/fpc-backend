import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { Interaction } from '../database/entities/interaction.entity';
import { Patient } from '../database/entities/patient.entity';
import { Reminder } from '../database/entities/reminder.entity';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
@Module({
  imports: [TypeOrmModule.forFeature([Interaction, Patient, Agent, Reminder])],
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
