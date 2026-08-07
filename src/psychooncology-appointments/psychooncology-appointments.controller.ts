import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import { AppointmentStatus } from '../database/entities/psychooncology-appointment.entity';
import { PsychooncologyAppointment } from '../database/entities/psychooncology-appointment.entity';
import {
  CreatePsychooncologyAppointmentDto,
  FindPsychooncologyAppointmentsQueryDto,
  UpdatePsychooncologyAppointmentDto,
} from './psychooncology-appointments.dto';
import { PsychooncologyAppointmentResponseDto } from './psychooncology-appointment-response.dto';
import { PsychooncologyAppointmentsService } from './psychooncology-appointments.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const SCHEDULE = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const CANCEL = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('psychooncology-appointments')
@ApiTags('psychooncology-appointments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class PsychooncologyAppointmentsController {
  constructor(private readonly service: PsychooncologyAppointmentsService) {}

  @Post()
  @Roles(...SCHEDULE)
  @ApiOperation({ summary: 'Schedule a psycho-oncology appointment' })
  @ApiCreatedResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiBadRequestResponse({
    description: 'The follow-up does not belong to the patient',
  })
  @ApiConflictResponse({
    description: 'Availability slot is reserved or volunteer is inactive',
  })
  @ApiForbiddenResponse({
    description:
      'Volunteers can only schedule appointments from their own availability',
  })
  @ApiNotFoundResponse({
    description:
      'Patient, follow-up, availability slot, or volunteer not found',
  })
  create(
    @Body() dto: CreatePsychooncologyAppointmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(dto, user).then(this.toResponse);
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List psycho-oncology appointments' })
  @ApiOkResponse({ type: PsychooncologyAppointmentResponseDto, isArray: true })
  @ApiQuery({ name: 'volunteerId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'patientId', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_ANSWER'],
  })
  @ApiBadRequestResponse({
    description: 'The authenticated volunteer has no profile',
  })
  findAll(
    @Query() query: FindPsychooncologyAppointmentsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .findAll(query, user)
      .then((items) => items.map(this.toResponse));
  }

  @Get(':id')
  @Roles(...READ)
  @ApiOperation({ summary: 'Get a psycho-oncology appointment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiBadRequestResponse({
    description: 'The authenticated volunteer has no profile',
  })
  @ApiForbiddenResponse({
    description: 'Volunteers can only access their own appointments',
  })
  @ApiNotFoundResponse({ description: 'Appointment not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user).then(this.toResponse);
  }

  @Patch(':id')
  @Roles(...READ)
  @ApiOperation({ summary: 'Update a psycho-oncology appointment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid appointment status transition',
  })
  @ApiConflictResponse({ description: 'Closed appointments cannot be updated' })
  @ApiForbiddenResponse({
    description: 'Volunteers have limited update permissions',
  })
  @ApiNotFoundResponse({
    description: 'Appointment or availability slot not found',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePsychooncologyAppointmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user).then(this.toResponse);
  }

  @Patch(':id/cancel')
  @Roles(...CANCEL)
  @ApiOperation({ summary: 'Cancel a psycho-oncology appointment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiConflictResponse({
    description: 'Closed appointments cannot be cancelled',
  })
  @ApiNotFoundResponse({
    description: 'Appointment or availability slot not found',
  })
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service
      .update(id, { status: AppointmentStatus.CANCELLED }, user)
      .then(this.toResponse);
  }

  private toResponse(
    this: void,
    item: PsychooncologyAppointment,
  ): PsychooncologyAppointmentResponseDto {
    return {
      id: item.id,
      patientId: item.patientId,
      volunteerId: item.volunteerId,
      followUpId: item.followUpId,
      availabilityId: item.availabilityId,
      patientEmail: item.patientEmail,
      sessionNumber: item.sessionNumber,
      isAdditionalSession: item.isAdditionalSession,
      modality: item.modality,
      status: item.status,
      scheduledAt: item.scheduledAt,
      completedAt: item.completedAt,
      topicAddressed: item.topicAddressed,
      sessionDetails: item.sessionDetails,
      additionalObservations: item.additionalObservations,
      recommendations: item.recommendations,
      referral: item.referral,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
