import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VolunteerAvailability } from '../database/entities/volunteer-availability.entity';
import { Volunteer } from '../database/entities/volunteer.entity';
import { VolunteerAvailabilityController } from './volunteer-availability.controller';
import { VolunteerAvailabilityService } from './volunteer-availability.service';

@Module({
  imports: [TypeOrmModule.forFeature([VolunteerAvailability, Volunteer])],
  controllers: [VolunteerAvailabilityController],
  providers: [VolunteerAvailabilityService],
  exports: [VolunteerAvailabilityService],
})
export class VolunteerAvailabilityModule {}
