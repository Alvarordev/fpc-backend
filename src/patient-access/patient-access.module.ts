import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PsychooncologyAppointment } from '../database/entities/psychooncology-appointment.entity';
import { Volunteer } from '../database/entities/volunteer.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PatientAccessService } from './patient-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, Volunteer, PsychooncologyAppointment]),
  ],
  providers: [PatientAccessService],
  exports: [PatientAccessService],
})
export class PatientAccessModule {}
