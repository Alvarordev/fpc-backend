import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { UsersModule } from '../users/users.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
@Module({
  imports: [TypeOrmModule.forFeature([Agent]), UsersModule],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
