import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
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
import { UserRole } from '../../../database/entities/user-role.enum';
import { User } from '../../../database/entities/user.entity';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { PatientDiagnosticStatusEventResponseDto } from './dto/patient-diagnostic-status-event-response.dto';
import { TransitionPatientDiagnosticStatusDto } from './dto/transition-patient-diagnostic-status.dto';
import { PatientDiagnosticStatusesService } from './patient-diagnostic-statuses.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/diagnostic-status')
@ApiTags('Patient diagnostic status')
@ApiBearerAuth()
export class PatientDiagnosticStatusesController {
  constructor(private readonly service: PatientDiagnosticStatusesService) {}

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List patient diagnostic status history' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({
    type: PatientDiagnosticStatusEventResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientDiagnosticStatusEventResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((event) =>
      PatientDiagnosticStatusEventResponseDto.from(event),
    );
  }

  @Get('current')
  @Roles(...READ)
  @ApiOperation({ summary: 'Get current patient diagnostic status' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({
    type: PatientDiagnosticStatusEventResponseDto,
    nullable: true,
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async current(
    @Param('patientId') patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientDiagnosticStatusEventResponseDto | null> {
    return this.service.responseForCurrent(patientId, user);
  }

  @Post('transition')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Transition patient diagnostic status' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientDiagnosticStatusEventResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid diagnostic transition' })
  @ApiConflictResponse({
    description: 'Patient is not searching for diagnosis',
  })
  @ApiNotFoundResponse({ description: 'Patient or follow-up not found' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async transition(
    @Param('patientId') patientId: string,
    @Body() dto: TransitionPatientDiagnosticStatusDto,
  ): Promise<PatientDiagnosticStatusEventResponseDto> {
    return PatientDiagnosticStatusEventResponseDto.from(
      await this.service.transition(patientId, dto),
    );
  }
}
