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
import { CreatePatientSisAffiliationDto } from './patient-sis-affiliation.dto';
import { PatientSisAffiliationResponseDto } from './patient-sis-affiliation-response.dto';
import { PatientSisAffiliationService } from './patient-sis-affiliation.service';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('patients/:patientId/sis-affiliations')
@ApiTags('Patient SIS affiliations')
@ApiBearerAuth()
export class PatientSisAffiliationController {
  constructor(private readonly service: PatientSisAffiliationService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a patient SIS affiliation' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientSisAffiliationResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or follow-up not found' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientSisAffiliationDto,
  ): Promise<PatientSisAffiliationResponseDto> {
    return PatientSisAffiliationResponseDto.from(
      await this.service.create(patientId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List patient SIS affiliation history' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientSisAffiliationResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
  ): Promise<PatientSisAffiliationResponseDto[]> {
    return (await this.service.findAll(patientId)).map((affiliation) =>
      PatientSisAffiliationResponseDto.from(affiliation),
    );
  }
}
