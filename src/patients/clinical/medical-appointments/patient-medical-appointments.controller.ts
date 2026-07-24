import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import { CreatePatientMedicalAppointmentDto } from './patient-medical-appointments.dto';
import { PatientMedicalAppointmentsService } from './patient-medical-appointments.service';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('patients/:patientId/medical-appointments')
export class PatientMedicalAppointmentsController {
  constructor(private readonly service: PatientMedicalAppointmentsService) {}
  @Post() @Roles(...WRITE) create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientMedicalAppointmentDto,
  ) {
    return this.service.create(patientId, dto);
  }
  @Get() @Roles(...READ) findAll(@Param('patientId') patientId: string) {
    return this.service.findAll(patientId);
  }
}
