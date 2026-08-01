import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import { CreatePatientMedicalAppointmentDto } from './patient-medical-appointments.dto';
import { PatientMedicalAppointmentResponseDto } from './patient-medical-appointments-response.dto';
import { PatientMedicalAppointmentsService } from './patient-medical-appointments.service';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('patients/:patientId/medical-appointments')
@ApiTags('Patient medical appointments')
@ApiBearerAuth()
export class PatientMedicalAppointmentsController {
  constructor(private readonly service: PatientMedicalAppointmentsService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a patient medical appointment' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientMedicalAppointmentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or follow-up not found' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientMedicalAppointmentDto,
  ): Promise<PatientMedicalAppointmentResponseDto> {
    return PatientMedicalAppointmentResponseDto.from(
      await this.service.create(patientId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List a patient medical appointment history' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientMedicalAppointmentResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
  ): Promise<PatientMedicalAppointmentResponseDto[]> {
    return (await this.service.findAll(patientId)).map((appointment) =>
      PatientMedicalAppointmentResponseDto.from(appointment),
    );
  }
}
