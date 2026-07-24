import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { CreatePatientSymptomReportDto } from './patient-symptom-reports.dto';
import { PatientSymptomReportsService } from './patient-symptom-reports.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/symptom-reports')
export class PatientSymptomReportsController {
  constructor(private readonly service: PatientSymptomReportsService) {}

  @Post() @Roles(...WRITE) create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientSymptomReportDto,
  ) {
    return this.service.create(patientId, dto);
  }

  @Get() @Roles(...READ) findAll(@Param('patientId') patientId: string) {
    return this.service.findAll(patientId);
  }
}
