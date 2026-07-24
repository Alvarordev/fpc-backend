import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import { CreatePatientInsuranceDto } from './patient-insurance.dto';
import { PatientInsuranceService } from './patient-insurance.service';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('patients/:patientId/insurance')
export class PatientInsuranceController {
  constructor(private readonly service: PatientInsuranceService) {}
  @Post() @Roles(...WRITE) create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientInsuranceDto,
  ) {
    return this.service.create(patientId, dto);
  }
  @Get() @Roles(...READ) findAll(@Param('patientId') patientId: string) {
    return this.service.findAll(patientId);
  }
}
