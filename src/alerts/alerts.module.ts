import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { Alert } from '../database/entities/alert.entity';
import { HealthCenter } from '../database/entities/health-center.entity';
import { Interaction } from '../database/entities/interaction.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Alert,
      Agent,
      HealthCenter,
      Interaction,
      Patient,
    ]),
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
