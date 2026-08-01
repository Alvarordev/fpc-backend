import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { CreatePatientTreatmentDto } from './patient-treatments.dto';
import { PatientTreatmentResponseDto } from './patient-treatments-response.dto';
import { PatientTreatmentsService } from './patient-treatments.service';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('patients/:patientId/treatments')
@ApiTags('Patient treatments')
@ApiBearerAuth()
export class PatientTreatmentsController {
  constructor(private readonly service: PatientTreatmentsService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a patient treatment' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientTreatmentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({
    description: 'Patient, follow-up, or diagnosis not found',
  })
  @ApiConflictResponse({
    description: 'Diagnosis does not belong to the patient',
  })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientTreatmentDto,
  ): Promise<PatientTreatmentResponseDto> {
    return PatientTreatmentResponseDto.from(
      await this.service.create(patientId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List a patient treatment history' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientTreatmentResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
  ): Promise<PatientTreatmentResponseDto[]> {
    return (await this.service.findAll(patientId)).map((treatment) =>
      PatientTreatmentResponseDto.from(treatment),
    );
  }
}
