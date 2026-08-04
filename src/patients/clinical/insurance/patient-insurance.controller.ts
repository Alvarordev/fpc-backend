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
import { CreatePatientInsuranceDto } from './patient-insurance.dto';
import { PatientInsuranceResponseDto } from './patient-insurance-response.dto';
import { PatientInsuranceService } from './patient-insurance.service';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('patients/:patientId/insurance')
@ApiTags('Patient insurance')
@ApiBearerAuth()
export class PatientInsuranceController {
  constructor(private readonly service: PatientInsuranceService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record patient insurance' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientInsuranceResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or follow-up not found' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientInsuranceDto,
  ): Promise<PatientInsuranceResponseDto> {
    return PatientInsuranceResponseDto.from(
      await this.service.create(patientId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List patient insurance history' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientInsuranceResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientInsuranceResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((insurance) =>
      PatientInsuranceResponseDto.from(insurance),
    );
  }
}
