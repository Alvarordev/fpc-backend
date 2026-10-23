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
import { UserRole } from '../../../../database/entities/user-role.enum';
import { User } from '../../../../database/entities/user.entity';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CreatePatientHealthBackgroundAssessmentDto } from './dto/create-patient-health-background-assessment.dto';
import { PatientHealthBackgroundAssessmentResponseDto } from './dto/patient-health-background-assessment-response.dto';
import { PatientHealthBackgroundAssessmentsService } from './patient-health-background-assessments.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/health-background-assessments')
@ApiTags('Patient health background assessments')
@ApiBearerAuth()
export class PatientHealthBackgroundAssessmentsController {
  constructor(
    private readonly service: PatientHealthBackgroundAssessmentsService,
  ) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a patient health background assessment' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientHealthBackgroundAssessmentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or follow-up not found' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientHealthBackgroundAssessmentDto,
  ): Promise<PatientHealthBackgroundAssessmentResponseDto> {
    return PatientHealthBackgroundAssessmentResponseDto.from(
      await this.service.create(patientId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List patient health background assessments' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({
    type: PatientHealthBackgroundAssessmentResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientHealthBackgroundAssessmentResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((assessment) =>
      PatientHealthBackgroundAssessmentResponseDto.from(assessment),
    );
  }
}
