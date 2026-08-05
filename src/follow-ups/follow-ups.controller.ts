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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../database/entities/user.entity';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Reminder } from '../database/entities/reminder.entity';
import { CreateReminderDto } from '../reminders/reminders.dto';
import { ReminderResponseDto } from '../reminders/reminder-response.dto';
import {
  CreateFollowUpDto,
  FindFollowUpsQueryDto,
  UpdateFollowUpDto,
} from './follow-ups.dto';
import { FollowUpResponseDto } from './follow-up-response.dto';
import { FollowUpsService } from './follow-ups.service';
import { UserRole } from '../database/entities/user-role.enum';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
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
  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List visible follow-ups' })
  @ApiOkResponse({ type: FollowUpResponseDto, isArray: true })
  @ApiQuery({ name: 'agentId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'patientId', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_ANSWER'],
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
  @ApiOperation({ summary: 'Get a follow-up' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FollowUpResponseDto })
  @ApiBadRequestResponse({
    description: 'The authenticated user has no agent profile',
  })
  @ApiForbiddenResponse({
    description: 'Patient is not assigned to the volunteer',
  })
  @ApiNotFoundResponse({ description: 'Follow-up not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOneForUser(id, user).then(this.toFollowUp);
  }
  @Patch(':id')
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
  @ApiNotFoundResponse({ description: 'Follow-up not found' })
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
  @Post(':id/reminders')
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
    return this.service
      .createReminder(id, dto, user.id, user.role)
      .then(this.toReminder);
  }

  private toFollowUp(this: void, item: FollowUp): FollowUpResponseDto {
    return {
      id: item.id,
      subjectPatientId: item.subjectPatientId,
      subjectPatientName: item.subjectPatient?.fullName ?? null,
      interlocutorId: item.interlocutorId,
      agentId: item.agentId,
      type: item.type,
      status: item.status,
      purpose: item.purpose,
      scheduledAt: item.scheduledAt,
      completedAt: item.completedAt,
      notes: item.notes,
      nextFollowUpId: item.nextFollowUpId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toReminder(this: void, item: Reminder): ReminderResponseDto {
    return {
      id: item.id,
      subjectPatientId: item.subjectPatientId,
      createdFromFollowUpId: item.createdFromFollowUpId,
      assignedAgentId: item.assignedAgentId,
      dueAt: item.dueAt,
      description: item.description,
      status: item.status,
      completedAt: item.completedAt,
      resultingFollowUpId: item.resultingFollowUpId,
      createdAt: item.createdAt,
    };
  }
}
