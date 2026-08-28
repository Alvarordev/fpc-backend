import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../../database/entities/user-role.enum';
import { CreatePatientDiagnosisDto } from './dto/create-patient-diagnosis.dto';
import { PatientDiagnosisResponseDto } from './dto/patient-diagnosis-response.dto';
import { PatientDiagnosesService } from './patient-diagnoses.service';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { User } from '../../../../database/entities/user.entity';
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
  @ApiOperation({
    summary: 'Record a patient diagnosis',
    description:
      'PARALLEL adds a new active diagnosis. REPLACE retires only the active diagnosis identified by replacementDiagnosisId and adds the new diagnosis as active.',
  })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientDiagnosisResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse({
    description:
      'The replacement diagnosis belongs to another patient or is not active',
  })
  @ApiNotFoundResponse({
    description: 'Patient, follow-up, or replacement diagnosis not found',
  })
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
    @CurrentUser() user: User,
  ): Promise<PatientDiagnosisResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((diagnosis) =>
      PatientDiagnosisResponseDto.from(diagnosis),
    );
  }
}
