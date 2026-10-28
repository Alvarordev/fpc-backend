import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantConversation } from '../../database/entities/assistant-conversation.entity';
import { AssistantMessage } from '../../database/entities/assistant-message.entity';
import { GeminiAssistantClient } from '../../integrations/gemini/gemini-assistant.client';
import { AlertsModule } from '../alerts/alerts.module';
import { CallCenterModule } from '../call-center/call-center.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { HealthCentersModule } from '../health-centers/health-centers.module';
import { PatientsModule } from '../patients/patients.module';
import { AssistantToolsService } from './assistant-tools.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssistantConversation, AssistantMessage]),
    ThrottlerModule,
    DashboardModule,
    PatientsModule,
    AlertsModule,
    CallCenterModule,
    HealthCentersModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantToolsService, GeminiAssistantClient],
})
export class AssistantModule {}
