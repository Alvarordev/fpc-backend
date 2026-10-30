import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { Agent } from '../../database/entities/agent.entity';
import { Alert } from '../../database/entities/alert.entity';
import { AlertEvent } from '../../database/entities/alert-event.entity';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { Patient } from '../../database/entities/patient.entity';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertEventsService } from './alert-events.service';
import { AlertSummaryService } from './alert-summary.service';
import { PatientAccessModule } from '../patients/access/patient-access.module';
import { N8nModule } from '../../integrations/n8n/n8n.module';
import { EmailModule } from '../../integrations/email/email.module';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { AlertReport } from '../../database/entities/alert-report.entity';
import { User } from '../../database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Alert,
      AlertEvent,
      AlertReport,
      Agent,
      User,
      HealthCenter,
      FollowUp,
      Patient,
    ]),
    PatientAccessModule,
    ThrottlerModule,
    N8nModule,
    EmailModule,
    CatalogsModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertEventsService, AlertSummaryService],
  exports: [AlertsService],
})
export class AlertsModule {}
