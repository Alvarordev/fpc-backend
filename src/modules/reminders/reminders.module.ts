import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reminder } from '../../database/entities/reminder.entity';
import { Agent } from '../../database/entities/agent.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { PatientsModule } from '../patients/patients.module';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { PatientAccessModule } from '../patients/access/patient-access.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reminder,
      Agent,
      FollowUp,
      Patient,
      PatientMedicalAppointment,
    ]),
    PatientAccessModule,
    PatientSummariesModule,
    PatientsModule,
    forwardRef(() => FollowUpsModule),
  ],
  controllers: [RemindersController],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
