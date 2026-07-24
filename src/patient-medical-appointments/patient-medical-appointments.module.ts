import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interaction } from '../database/entities/interaction.entity';
import { PatientMedicalAppointment } from '../database/entities/patient-medical-appointment.entity';
import { PatientsModule } from '../patients/patients.module';
import { PatientMedicalAppointmentsController } from './patient-medical-appointments.controller';
import { PatientMedicalAppointmentsService } from './patient-medical-appointments.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([PatientMedicalAppointment, Interaction]),
    PatientsModule,
  ],
  controllers: [PatientMedicalAppointmentsController],
  providers: [PatientMedicalAppointmentsService],
  exports: [PatientMedicalAppointmentsService],
})
export class PatientMedicalAppointmentsModule {}
