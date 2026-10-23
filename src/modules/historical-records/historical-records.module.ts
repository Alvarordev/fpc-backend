import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { PatientsModule } from '../patients/patients.module';
import { PsychooncologyAppointmentsModule } from '../psychooncology-appointments/psychooncology-appointments.module';
import { RemindersModule } from '../reminders/reminders.module';
import { HistoricalRecordsController } from './historical-records.controller';
import { HistoricalRecordsService } from './historical-records.service';

@Module({
  imports: [
    EnrollmentsModule,
    FollowUpsModule,
    RemindersModule,
    PatientsModule,
    PsychooncologyAppointmentsModule,
  ],
  controllers: [HistoricalRecordsController],
  providers: [HistoricalRecordsService],
  exports: [HistoricalRecordsService],
})
export class HistoricalRecordsModule {}
