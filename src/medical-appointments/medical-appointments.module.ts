import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { PatientMedicalAppointment } from '../database/entities/patient-medical-appointment.entity';
import { PatientsModule } from '../patients/patients.module';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { PatientAccessModule } from '../patient-access/patient-access.module';
import { N8nModule } from '../integrations/n8n/n8n.module';
import { MedicalAppointmentsController } from './medical-appointments.controller';
import { MedicalAppointmentsService } from './medical-appointments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatientMedicalAppointment, Agent]),
    PatientsModule,
    FollowUpsModule,
    PatientSummariesModule,
    PatientAccessModule,
    N8nModule,
  ],
  controllers: [MedicalAppointmentsController],
  providers: [MedicalAppointmentsService],
})
export class MedicalAppointmentsModule {}
