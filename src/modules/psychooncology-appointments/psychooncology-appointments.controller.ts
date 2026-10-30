import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import {
  AppointmentStatus,
  PsychooncologyAppointment,
} from '../../database/entities/psychooncology-appointment.entity';
import { CreatePsychooncologyAppointmentDto } from './dto/create-psychooncology-appointment.dto';
import { FindPsychooncologyAppointmentsQueryDto } from './dto/list-psychooncology-appointments.dto';
import { UpdatePsychooncologyAppointmentDto } from './dto/update-psychooncology-appointment.dto';
import { PsychooncologyAppointmentResponseDto } from './dto/psychooncology-appointment-response.dto';
import { ReschedulePsychooncologyAppointmentDto } from './dto/reschedule-psychooncology-appointment.dto';
import { SetReminderMessageDto } from '../reminders/dto/set-reminder-message.dto';
import { AppointmentReminderResponseDto } from './dto/appointment-reminder-response.dto';
import { UnmanagedNoShowsResponseDto } from './dto/unmanaged-no-shows-response.dto';
import { PsychooncologyAppointmentsService } from './psychooncology-appointments.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const MANAGE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('psychooncology-appointments')
@ApiTags('psychooncology-appointments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class PsychooncologyAppointmentsController {
  constructor(private readonly service: PsychooncologyAppointmentsService) {}

  @Post()
  @Roles(...MANAGE)
  @ApiOperation({
    summary: 'Schedule a psycho-oncology appointment on a free slot',
    description:
      'Opens a care cycle when the patient has none. After the 4 base sessions, only additional sessions can be scheduled.',
  })
  @ApiCreatedResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid companion, follow-up, or reminder',
  })
  @ApiConflictResponse({
    description:
      'Slot reserved or past, volunteer inactive, or base cycle already full',
  })
  @ApiNotFoundResponse({
    description:
      'Patient, follow-up, availability slot, or volunteer not found',
  })
  create(@Body() dto: CreatePsychooncologyAppointmentDto) {
    return this.service.create(dto).then(this.toResponse);
  }

  @Get('needs-reassignment')
  @Roles(...MANAGE)
  @ApiOperation({
    summary: 'List pending sessions of deactivated volunteers to reassign',
  })
  @ApiOkResponse({ type: PsychooncologyAppointmentResponseDto, isArray: true })
  findNeedingReassignment(@CurrentUser() user: User) {
    return this.service
      .findNeedingReassignment(user)
      .then((items) => items.map(this.toResponse));
  }

  @Get('patients/:patientId/unmanaged-no-shows')
  @Roles(...READ)
  @ApiOperation({
    summary: 'Whether a patient has no-show sessions nobody followed up yet',
  })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: UnmanagedNoShowsResponseDto })
  @ApiForbiddenResponse({ description: 'Patient is not accessible' })
  findUnmanagedNoShows(
    @Param('patientId') patientId: string,
    @CurrentUser() user: User,
  ): Promise<UnmanagedNoShowsResponseDto> {
    return this.service.findUnmanagedNoShows(patientId, user);
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
    enum: AppointmentStatus,
  })
  @ApiQuery({ name: 'cycleId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'needsReassignment', required: false, type: Boolean })
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
  @ApiOperation({
    summary: 'Update a psycho-oncology appointment',
    description:
      'Volunteers only record results (status COMPLETED/NO_SHOW and session fields) of their own sessions; agents only edit logistics.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid status transition or reminder',
  })
  @ApiConflictResponse({
    description: 'No se puede modificar una cita cancelada o reprogramada.',
  })
  @ApiForbiddenResponse({
    description: 'The role cannot edit some of the given fields',
  })
  @ApiNotFoundResponse({ description: 'Appointment not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePsychooncologyAppointmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user).then(this.toResponse);
  }

  @Patch(':id/cancel')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Cancel a psycho-oncology appointment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiConflictResponse({
    description: 'Only scheduled or overdue appointments can be cancelled',
  })
  @ApiNotFoundResponse({ description: 'Appointment not found' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id).then(this.toResponse);
  }

  @Post(':id/reschedule')
  @Roles(...MANAGE)
  @ApiOperation({
    summary: 'Reschedule a session to another free slot',
    description:
      'The slot may belong to another volunteer. The original session becomes RESCHEDULED and links to the returned new session.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiConflictResponse({
    description:
      'Appointment not pending, slot reserved or past, or volunteer inactive',
  })
  @ApiNotFoundResponse({ description: 'Appointment or slot not found' })
  reschedule(
    @Param('id') id: string,
    @Body() dto: ReschedulePsychooncologyAppointmentDto,
  ) {
    return this.service.reschedule(id, dto).then(this.toResponse);
  }

  @Get(':id/reminder')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Get the ready-to-copy reminder of a session' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AppointmentReminderResponseDto })
  @ApiConflictResponse({ description: 'Video call session without Zoom link' })
  reminder(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<AppointmentReminderResponseDto> {
    return this.service.reminderMessage(id, user);
  }

  @Put(':id/reminder/message')
  @Roles(...MANAGE)
  @ApiOperation({
    summary:
      'Save the reminder text of a session (empty restores the suggested text)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AppointmentReminderResponseDto })
  @ApiConflictResponse({ description: 'Session not pending' })
  setReminderMessage(
    @Param('id') id: string,
    @Body() dto: SetReminderMessageDto,
    @CurrentUser() user: User,
  ): Promise<AppointmentReminderResponseDto> {
    return this.service.setReminderMessage(id, dto.text, user);
  }

  @Patch(':id/reminder/sent')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Mark the session reminder as sent manually' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AppointmentReminderResponseDto })
  @ApiConflictResponse({
    description: 'Session not pending, or video call without Zoom link',
  })
  markReminderSent(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<AppointmentReminderResponseDto> {
    return this.service.markReminderSent(id, user);
  }

  @Patch(':id/no-show-managed')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Mark a no-show session as managed' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiConflictResponse({ description: 'The session is not a no-show' })
  markNoShowManaged(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.markNoShowManaged(id, user).then(this.toResponse);
  }

  private toResponse(
    this: void,
    item: PsychooncologyAppointment,
  ): PsychooncologyAppointmentResponseDto {
    return {
      id: item.id,
      patientId: item.patientId,
      beneficiaryType: item.beneficiaryType,
      companionId: item.companionId,
      companionFullName: item.companion?.fullName ?? null,
      volunteerId: item.volunteerId,
      volunteerFullName: item.volunteer
        ? `${item.volunteer.firstName} ${item.volunteer.lastName}`
        : 'Voluntario no identificado',
      followUpId: item.followUpId,
      availabilityId: item.availabilityId,
      patientEmail: item.patientEmail,
      zoomLink: item.zoomLink,
      sessionNumber: item.sessionNumber,
      isAdditionalSession: item.isAdditionalSession,
      modality: item.modality,
      status: item.status,
      scheduledAt: item.scheduledAt,
      scheduledOn: item.scheduledOn,
      completedAt: item.completedAt,
      completedOn: item.completedOn,
      topicAddressed: item.topicAddressed,
      sessionDetails: item.sessionDetails,
      additionalObservations: item.additionalObservations,
      recommendations: item.recommendations,
      referral: item.referral,
      schedulingNotes: item.schedulingNotes,
      noAnswerNote: item.noAnswerNote,
      satisfactionRating: item.satisfactionRating,
      satisfactionComment: item.satisfactionComment,
      cycleId: item.cycleId,
      rescheduledToId: item.rescheduledToId,
      needsReassignment: item.needsReassignment,
      reminderMode: item.reminderMode,
      remindAt: item.remindAt,
      reminderSentAt: item.reminderSentAt,
      noShowManagedAt: item.noShowManagedAt,
      noShowManagedById: item.noShowManagedById,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isHistorical: item.isHistorical,
    };
  }
}
