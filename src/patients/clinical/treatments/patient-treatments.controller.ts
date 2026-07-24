import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import { CreatePatientTreatmentDto } from './patient-treatments.dto';
import { PatientTreatmentsService } from './patient-treatments.service';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('patients/:patientId/treatments')
export class PatientTreatmentsController {
  constructor(private readonly service: PatientTreatmentsService) {}
  @Post() @Roles(...WRITE) create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientTreatmentDto,
  ) {
    return this.service.create(patientId, dto);
  }
  @Get() @Roles(...READ) findAll(@Param('patientId') patientId: string) {
    return this.service.findAll(patientId);
  }
}
