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
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import { CreatePatientSymptomReportDto } from './dto/create-patient-symptom-report.dto';
import { PatientSymptomReportResponseDto } from './dto/patient-symptom-report-response.dto';
import { PatientSymptomReportsService } from './patient-symptom-reports.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/symptom-reports')
@ApiTags('Patient symptom reports')
@ApiBearerAuth()
export class PatientSymptomReportsController {
  constructor(private readonly service: PatientSymptomReportsService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a patient symptom report' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientSymptomReportResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({
    description: 'Patient, follow-up, or enrollment not found',
  })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientSymptomReportDto,
  ): Promise<PatientSymptomReportResponseDto> {
    return PatientSymptomReportResponseDto.from(
      await this.service.create(patientId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List patient symptom reports' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientSymptomReportResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientSymptomReportResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((report) =>
      PatientSymptomReportResponseDto.from(report),
    );
  }
}
