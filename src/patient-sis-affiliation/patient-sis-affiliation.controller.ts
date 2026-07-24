import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { CreatePatientSisAffiliationDto } from './patient-sis-affiliation.dto';
import { PatientSisAffiliationService } from './patient-sis-affiliation.service';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('patients/:patientId/sis-affiliations')
export class PatientSisAffiliationController {
  constructor(private readonly service: PatientSisAffiliationService) {}
  @Post() @Roles(...WRITE) create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientSisAffiliationDto,
  ) {
    return this.service.create(patientId, dto);
  }
  @Get() @Roles(...READ) findAll(@Param('patientId') patientId: string) {
    return this.service.findAll(patientId);
  }
}
