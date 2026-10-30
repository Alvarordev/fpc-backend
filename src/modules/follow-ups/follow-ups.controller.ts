import { AuditFollowUpParam } from '../../shared/audit/audit-context';
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
import { User } from '../../database/entities/user.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { FollowUpAttempt } from '../../database/entities/follow-up-attempt.entity';
import { FollowUpStatus } from '../../database/entities/follow-up.enums';
import { CreateFollowUpAttemptDto } from './dto/create-follow-up-attempt.dto';
import { RescheduleFollowUpDto } from './dto/reschedule-follow-up.dto';
import { FollowUpAttemptResponseDto } from './dto/follow-up-attempt-response.dto';
import { Reminder } from '../../database/entities/reminder.entity';
import { toReminderResponse } from '../reminders/reminder-response.mapper';
import { CreateReminderDto } from '../reminders/dto/create-reminder.dto';
import { ReminderResponseDto } from '../reminders/dto/reminder-response.dto';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { FindFollowUpsQueryDto } from './dto/list-follow-ups.dto';
import { UpdateFollowUpDto } from './dto/update-follow-up.dto';
import { FollowUpResponseDto } from './dto/follow-up-response.dto';
import { CreateFollowUpsBatchDto } from './dto/create-follow-ups-batch.dto';
import { FollowUpsService, interlocutorIdOf } from './follow-ups.service';
import { UserRole } from '../../database/entities/user-role.enum';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

function toAttempt(item: FollowUpAttempt): FollowUpAttemptResponseDto {
  return {
    id: item.id,
    followUpId: item.followUpId,
    channel: item.channel,
    outcome: item.outcome,
    occurredAt: item.occurredAt,
    actorUserId: item.actorUserId,
    notes: item.notes,
    createdAt: item.createdAt,
  };
}

@Controller('follow-ups')
@ApiTags('follow-ups')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class FollowUpsController {
  constructor(private readonly service: FollowUpsService) {}
  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Create a follow-up' })
  @ApiCreatedResponse({ type: FollowUpResponseDto })
  @ApiBadRequestResponse({
    description: 'Required agent assignment is missing',
  })
  @ApiForbiddenResponse({
    description: 'Agents can only assign follow-ups to themselves',
  })
  @ApiNotFoundResponse({ description: 'Patient or agent not found' })
  create(@Body() dto: CreateFollowUpDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id, user.role).then(this.toFollowUp);
  }
  @Post('batch')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Create multiple future follow-ups' })
  @ApiCreatedResponse({ type: FollowUpResponseDto, isArray: true })
  @ApiBadRequestResponse({
    description:
      'The batch must contain future follow-ups for the same patient',
  })
  @ApiForbiddenResponse({
    description: 'Agents can only assign follow-ups to themselves',
  })
  @ApiNotFoundResponse({ description: 'Patient or agent not found' })
  createBatch(@Body() dto: CreateFollowUpsBatchDto, @CurrentUser() user: User) {
    return this.service
      .createBatch(dto, user.id, user.role)
      .then((items) => items.map(this.toFollowUp));
  }
  @Get()
  @Roles(...READ)
  @ApiOperation({
    summary: 'List visible follow-ups',
    description:
      'Includes historical follow-ups and enrollments. Agents see every follow-up of a patient when patientId is given; otherwise only their own unless agentId is given.',
  })
  @ApiOkResponse({ type: FollowUpResponseDto, isArray: true })
  @ApiQuery({ name: 'agentId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'patientId', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: FollowUpStatus,
  })
  @ApiBadRequestResponse({
    description: 'The authenticated agent has no profile',
  })
  findAll(@Query() query: FindFollowUpsQueryDto, @CurrentUser() user: User) {
    return this.service
      .findAllForUser(query, user)
      .then((items) => items.map(this.toFollowUp));
  }
  @Get(':id')
  @Roles(...READ)
  @ApiOperation({ summary: 'Get a follow-up with its attempts' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FollowUpResponseDto })
  @ApiBadRequestResponse({
    description: 'The authenticated user has no agent profile',
  })
  @ApiForbiddenResponse({
    description: 'Patient is not assigned to the volunteer',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el seguimiento.' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOneForUser(id, user).then(this.toFollowUp);
  }
  @Patch(':id')
  @AuditFollowUpParam('id')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Update a follow-up' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FollowUpResponseDto })
  @ApiBadRequestResponse({
    description: 'The authenticated user has no agent profile',
  })
  @ApiForbiddenResponse({
    description: 'Agents can only update their own follow-ups',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el seguimiento.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFollowUpDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .update(id, dto, user.id, user.role)
      .then(this.toFollowUp);
  }
  @Post(':id/schedule-next')
  @AuditFollowUpParam('id')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Schedule the next follow-up' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: FollowUpResponseDto })
  @ApiBadRequestResponse({
    description: 'Required agent assignment is missing',
  })
  @ApiForbiddenResponse({
    description: 'Agents can only access their own follow-ups',
  })
  @ApiNotFoundResponse({
    description: 'Follow-up, patient, or agent not found',
  })
  next(
    @Param('id') id: string,
    @Body() dto: CreateFollowUpDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .scheduleNext(id, dto, user.id, user.role)
      .then(this.toFollowUp);
  }
  @Post(':id/attempts')
  @AuditFollowUpParam('id')
  @Roles(...WRITE)
  @ApiOperation({
    summary: 'Record a contact attempt',
    description:
      'A CONTACTED attempt completes the follow-up; a failed one marks it NO_ANSWER unless it was already completed.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: FollowUpAttemptResponseDto })
  @ApiBadRequestResponse({ description: 'The follow-up is cancelled' })
  @ApiForbiddenResponse({
    description: 'Solo puedes modificar tus propios seguimientos.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el seguimiento.' })
  attempt(
    @Param('id') id: string,
    @Body() dto: CreateFollowUpAttemptDto,
    @CurrentUser() user: User,
  ) {
    return this.service.addAttempt(id, dto, user).then(toAttempt);
  }
  @Post(':id/reschedule')
  @AuditFollowUpParam('id')
  @Roles(...WRITE)
  @ApiOperation({
    summary: 'Reschedule an overdue or cancelled follow-up',
    description:
      'Creates a new scheduled follow-up linked through nextFollowUpId.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: FollowUpResponseDto })
  @ApiBadRequestResponse({
    description:
      'The follow-up is not overdue or cancelled, was already rescheduled, or the date is in the past',
  })
  @ApiForbiddenResponse({
    description: 'Solo puedes modificar tus propios seguimientos.',
  })
  @ApiNotFoundResponse({ description: 'Follow-up or agent not found' })
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleFollowUpDto,
    @CurrentUser() user: User,
  ) {
    return this.service.reschedule(id, dto, user).then(this.toFollowUp);
  }
  @Post(':id/reminders')
  @AuditFollowUpParam('id')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Create a reminder from a follow-up' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ReminderResponseDto })
  @ApiBadRequestResponse({
    description: 'Required agent assignment is missing',
  })
  @ApiForbiddenResponse({
    description: 'Agents can only access their own follow-ups',
  })
  @ApiNotFoundResponse({ description: 'Follow-up or agent not found' })
  reminder(
    @Param('id') id: string,
    @Body() dto: CreateReminderDto,
    @CurrentUser() user: User,
  ) {
    return this.service.createReminder(id, dto, user).then(this.toReminder);
  }

  private toFollowUp(this: void, item: FollowUp): FollowUpResponseDto {
    return {
      id: item.id,
      subjectPatientId: item.subjectPatientId,
      subjectPatientName: item.subjectPatient?.fullName ?? null,
      interlocutorId: interlocutorIdOf(item),
      agentId: item.agentId,
      type: item.type,
      status: item.status,
      purpose: item.purpose,
      scheduledAt: item.scheduledAt,
      scheduledOn: item.scheduledOn,
      completedAt: item.completedAt,
      completedOn: item.completedOn,
      notes: item.notes,
      nextFollowUpId: item.nextFollowUpId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isHistorical: item.isHistorical,
      attempts: item.attempts?.map(toAttempt),
    };
  }

  private toReminder(this: void, item: Reminder): ReminderResponseDto {
    return toReminderResponse(item);
  }
}
