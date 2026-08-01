import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PsychooncologyAppointment } from '../database/entities/psychooncology-appointment.entity';
import { VolunteerAvailability } from '../database/entities/volunteer-availability.entity';
import { Volunteer } from '../database/entities/volunteer.entity';
import { PsychooncologyAppointmentsController } from './psychooncology-appointments.controller';
import { PsychooncologyAppointmentsService } from './psychooncology-appointments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PsychooncologyAppointment,
      VolunteerAvailability,
      Volunteer,
      Patient,
      FollowUp,
      Agent,
    ]),
  ],
  controllers: [PsychooncologyAppointmentsController],
  providers: [PsychooncologyAppointmentsService],
})
export class PsychooncologyAppointmentsModule {}
