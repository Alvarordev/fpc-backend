import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { Reminder } from '../database/entities/reminder.entity';
import {
  CreateReminderDto,
  CompleteReminderDto,
  UpdateReminderDto,
} from './reminders.dto';
import { ReminderResponseDto } from './reminder-response.dto';
import { RemindersService } from './reminders.service';
const ROLES = ['ADMIN', 'FOUNDATION', 'AGENT'];
@Controller('reminders')
@ApiTags('reminders')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class RemindersController {
  constructor(private readonly service: RemindersService) {}
  @Post()
  @Roles(...ROLES)
  @ApiOperation({ summary: 'Create a reminder' })
  @ApiCreatedResponse({ type: ReminderResponseDto })
  @ApiBadRequestResponse({
    description: 'Required agent assignment is missing',
  })
  @ApiForbiddenResponse({ description: 'Agents cannot reassign reminders' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  create(@Body() dto: CreateReminderDto, @CurrentUser() user: User) {
    return this.service.create(dto, user).then(this.toResponse);
  }
  @Get()
  @Roles(...ROLES)
  @ApiOperation({ summary: 'List reminders visible to the current user' })
  @ApiOkResponse({ type: ReminderResponseDto, isArray: true })
  @ApiBadRequestResponse({
    description: 'The authenticated user has no agent profile',
  })
  all(@CurrentUser() user: User) {
    return this.service
      .findAll(user)
      .then((items) => items.map(this.toResponse));
  }
  @Patch(':id')
  @Roles(...ROLES)
  @ApiOperation({ summary: 'Update a pending reminder' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReminderResponseDto })
  @ApiBadRequestResponse({ description: 'Closed reminders cannot be edited' })
  @ApiForbiddenResponse({
    description: 'Agents can only update their own reminders',
  })
  @ApiNotFoundResponse({ description: 'Reminder or agent not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user).then(this.toResponse);
  }
  @Patch(':id/complete')
  @Roles(...ROLES)
  @ApiOperation({ summary: 'Complete a pending reminder' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReminderResponseDto })
  @ApiBadRequestResponse({
    description: 'Reminder is not pending or the follow-up is invalid',
  })
  @ApiForbiddenResponse({
    description: 'Agents can only complete their own reminders',
  })
  @ApiNotFoundResponse({ description: 'Reminder not found' })
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteReminderDto,
    @CurrentUser() user: User,
  ) {
    return this.service.complete(id, dto, user).then(this.toResponse);
  }
  @Patch(':id/dismiss')
  @Roles(...ROLES)
  @ApiOperation({ summary: 'Dismiss a pending reminder' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReminderResponseDto })
  @ApiBadRequestResponse({
    description: 'Only pending reminders can be dismissed',
  })
  @ApiForbiddenResponse({
    description: 'Agents can only dismiss their own reminders',
  })
  @ApiNotFoundResponse({ description: 'Reminder not found' })
  dismiss(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.dismiss(id, user).then(this.toResponse);
  }

  private toResponse(this: void, item: Reminder): ReminderResponseDto {
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
