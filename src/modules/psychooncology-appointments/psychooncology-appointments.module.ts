import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { PsychooncologyAppointment } from '../../database/entities/psychooncology-appointment.entity';
import { VolunteerAvailability } from '../../database/entities/volunteer-availability.entity';
import { Volunteer } from '../../database/entities/volunteer.entity';
import { PsychooncologyAppointmentsController } from './psychooncology-appointments.controller';
import { PsychooncologyAppointmentsService } from './psychooncology-appointments.service';
import { PatientAccessModule } from '../patients/access/patient-access.module';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PsychooncologyAppointment,
      VolunteerAvailability,
      Volunteer,
      Patient,
    ]),
    PatientAccessModule,
    PatientSummariesModule,
  ],
  controllers: [PsychooncologyAppointmentsController],
  providers: [PsychooncologyAppointmentsService],
  exports: [PsychooncologyAppointmentsService],
})
export class PsychooncologyAppointmentsModule {}
