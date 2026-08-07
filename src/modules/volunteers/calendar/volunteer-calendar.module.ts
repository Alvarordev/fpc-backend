import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PsychooncologyAppointment } from '../../../database/entities/psychooncology-appointment.entity';
import { VolunteerAvailability } from '../../../database/entities/volunteer-availability.entity';
import { Volunteer } from '../../../database/entities/volunteer.entity';
import { VolunteerCalendarController } from './volunteer-calendar.controller';
import { VolunteerCalendarService } from './volunteer-calendar.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Volunteer,
      VolunteerAvailability,
      PsychooncologyAppointment,
    ]),
  ],
  controllers: [VolunteerCalendarController],
  providers: [VolunteerCalendarService],
})
export class VolunteerCalendarModule {}
