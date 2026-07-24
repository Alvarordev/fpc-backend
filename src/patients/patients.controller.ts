import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { DeactivatePatientDto } from './dto/deactivate-patient.dto';
import { ListPatientsDto } from './dto/list-patients.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpsertPatientDetailsDto } from './dto/upsert-patient-details.dto';
import { PatientsService } from './patients.service';

const PATIENT_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const PATIENT_WRITE_ROLES = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
];

@Controller('patients')
@ApiBearerAuth()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(...PATIENT_WRITE_ROLES)
  create(@Body() input: CreatePatientDto) {
    return this.patientsService.create(input);
  }

  @Post(':id/companions')
  @Roles(...PATIENT_WRITE_ROLES)
  createCompanion(@Param('id') id: string, @Body() input: CreateCompanionDto) {
    return this.patientsService.createCompanion(id, input);
  }

  @Get()
  @Roles(...PATIENT_READ_ROLES)
  findAll(@Query() filters: ListPatientsDto) {
    return this.patientsService.findAll(filters);
  }

  @Get(':id')
  @Roles(...PATIENT_READ_ROLES)
  findOne(@Param('id') id: string) {
    return this.patientsService.findById(id);
  }

  @Patch(':id')
  @Roles(...PATIENT_WRITE_ROLES)
  update(@Param('id') id: string, @Body() input: UpdatePatientDto) {
    return this.patientsService.update(id, input);
  }

  @Patch(':id/deactivate')
  @Roles(...PATIENT_WRITE_ROLES)
  deactivate(@Param('id') id: string, @Body() input: DeactivatePatientDto) {
    return this.patientsService.deactivate(id, input);
  }

  @Patch(':id/reactivate')
  @Roles(...PATIENT_WRITE_ROLES)
  reactivate(@Param('id') id: string) {
    return this.patientsService.reactivate(id);
  }

  @Put(':id/details')
  @Roles(...PATIENT_WRITE_ROLES)
  upsertDetails(
    @Param('id') id: string,
    @Body() input: UpsertPatientDetailsDto,
  ) {
    return this.patientsService.upsertDetails(id, input);
  }
}
