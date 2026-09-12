import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
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
import {
  CreatePatientNonOncologicalFollowUpDto,
  UpdatePatientNonOncologicalFollowUpDto,
} from './dto/create-patient-non-oncological-follow-up.dto';
import { PatientNonOncologicalFollowUpResponseDto } from './dto/patient-non-oncological-follow-up-response.dto';
import { PatientNonOncologicalFollowUpsService } from './patient-non-oncological-follow-ups.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/non-oncological-follow-ups')
@ApiTags('Patient non-oncological follow-ups')
@ApiBearerAuth()
export class PatientNonOncologicalFollowUpsController {
  constructor(
    private readonly service: PatientNonOncologicalFollowUpsService,
  ) {}

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List patient non-oncological follow-ups' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({
    type: PatientNonOncologicalFollowUpResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientNonOncologicalFollowUpResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((record) =>
      PatientNonOncologicalFollowUpResponseDto.from(record),
    );
  }

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a non-oncological follow-up' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientNonOncologicalFollowUpResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid non-oncological follow-up' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({
    description: 'Patient, follow-up, or enrollment not found',
  })
  async create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() input: CreatePatientNonOncologicalFollowUpDto,
  ): Promise<PatientNonOncologicalFollowUpResponseDto> {
    return PatientNonOncologicalFollowUpResponseDto.from(
      await this.service.create(patientId, input),
    );
  }

  @Patch(':id')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Update or discharge a non-oncological follow-up' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PatientNonOncologicalFollowUpResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid non-oncological follow-up' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Non-oncological follow-up not found' })
  async update(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdatePatientNonOncologicalFollowUpDto,
  ): Promise<PatientNonOncologicalFollowUpResponseDto> {
    return PatientNonOncologicalFollowUpResponseDto.from(
      await this.service.update(patientId, id, input),
    );
  }
}
