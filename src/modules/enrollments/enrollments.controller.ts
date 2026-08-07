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
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { CreateEnrollmentDto } from './enrollments.dto';
import { EnrollmentResponseDto } from './enrollment-response.dto';
import { EnrollmentsService } from './enrollments.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('enrollments')
@ApiTags('enrollments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Create a patient enrollment' })
  @ApiCreatedResponse({ type: EnrollmentResponseDto })
  @ApiBadRequestResponse({ description: 'Enrollment data is invalid' })
  @ApiConflictResponse({
    description: 'Patient is already enrolled or enrollment data conflicts',
  })
  @ApiForbiddenResponse({ description: 'Agent assignment is not permitted' })
  @ApiNotFoundResponse({
    description: 'Patient, companion, or agent not found',
  })
  create(@Body() dto: CreateEnrollmentDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id, user.role).then(this.toResponse);
  }

  @Get('patient/:patientId')
  @Roles(...READ)
  @ApiOperation({ summary: 'List a patient enrollments' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: EnrollmentResponseDto, isArray: true })
  findAll(@Param('patientId') patientId: string, @CurrentUser() user: User) {
    return this.service
      .findAll(patientId, user)
      .then((items) => items.map(this.toResponse));
  }

  private toResponse(this: void, item: Enrollment): EnrollmentResponseDto {
    return {
      id: item.id,
      patientId: item.patientId,
      followUpId: item.followUpId,
      affiliationType: item.affiliationType,
      companionId: item.companionId,
      currentlyAttendingConsultations: item.currentlyAttendingConsultations,
      currentlyReceivingTreatment: item.currentlyReceivingTreatment,
      entrySource: item.entrySource,
      entrySubSource: item.entrySubSource,
      consentToContact: item.consentToContact,
      consentToShareData: item.consentToShareData,
      requiresTransportation: item.requiresTransportation,
      hasMobilityIssues: item.hasMobilityIssues,
      isOncologicalPatient: item.isOncologicalPatient,
      surveyAccepted: item.surveyAccepted,
      caseComments: item.caseComments,
      callStartedAt: item.callStartedAt,
      callEndedAt: item.callEndedAt,
      followUpQualityRating: item.followUpQualityRating,
      createdAt: item.createdAt,
    };
  }
}
