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
import { CreatePatientDiagnosisDto } from './patient-diagnoses.dto';
import { PatientDiagnosisResponseDto } from './patient-diagnoses-response.dto';
import { PatientDiagnosesService } from './patient-diagnoses.service';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('patients/:patientId/diagnoses')
@ApiTags('Patient diagnoses')
@ApiBearerAuth()
export class PatientDiagnosesController {
  constructor(private readonly service: PatientDiagnosesService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a patient diagnosis' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientDiagnosisResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or follow-up not found' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientDiagnosisDto,
  ): Promise<PatientDiagnosisResponseDto> {
    return PatientDiagnosisResponseDto.from(
      await this.service.create(patientId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List a patient diagnosis history' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientDiagnosisResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
  ): Promise<PatientDiagnosisResponseDto[]> {
    return (await this.service.findAll(patientId)).map((diagnosis) =>
      PatientDiagnosisResponseDto.from(diagnosis),
    );
  }
}
