import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reminder } from '../database/entities/reminder.entity';
import { Agent } from '../database/entities/agent.entity';
import { Interaction } from '../database/entities/interaction.entity';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
@Module({
  imports: [TypeOrmModule.forFeature([Reminder, Agent, Interaction])],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
