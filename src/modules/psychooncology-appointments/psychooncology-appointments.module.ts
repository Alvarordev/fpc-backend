import { EmailModule } from '../../integrations/email/email.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { PsychooncologyAppointment } from '../../database/entities/psychooncology-appointment.entity';
import { PsychooncologyCycle } from '../../database/entities/psychooncology-cycle.entity';
import { VolunteerAvailability } from '../../database/entities/volunteer-availability.entity';
import { Volunteer } from '../../database/entities/volunteer.entity';
import { PsychooncologyAppointmentsController } from './psychooncology-appointments.controller';
import { PsychooncologyAppointmentsService } from './psychooncology-appointments.service';
import { PsychooncologyAppointmentsJob } from './psychooncology-appointments.job';
import { PsychooncologyCyclesController } from './psychooncology-cycles.controller';
import { PsychooncologyCyclesService } from './psychooncology-cycles.service';
import { PatientAccessModule } from '../patients/access/patient-access.module';
import { PatientSummariesModule } from '../patient-summaries/patient-summaries.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PsychooncologyAppointment,
      PsychooncologyCycle,
      VolunteerAvailability,
      Volunteer,
      Patient,
    ]),
    PatientAccessModule,
    EmailModule,
    PatientSummariesModule,
  ],
  controllers: [
    PsychooncologyAppointmentsController,
    PsychooncologyCyclesController,
  ],
  providers: [
    PsychooncologyAppointmentsService,
    PsychooncologyCyclesService,
    PsychooncologyAppointmentsJob,
  ],
  exports: [PsychooncologyAppointmentsService],
})
export class PsychooncologyAppointmentsModule {}
