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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { CompleteReminderDto } from './dto/complete-reminder.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ListRemindersDto } from './dto/list-reminders.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ReminderResponseDto } from './dto/reminder-response.dto';
import { RemindersService } from './reminders.service';
import { UserRole } from '../../database/entities/user-role.enum';
const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('reminders')
@ApiTags('reminders')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class RemindersController {
  constructor(private readonly service: RemindersService) {}
  @Post()
  @Roles(...WRITE)
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
  @Roles(...READ)
  @ApiOperation({ summary: 'List reminders visible to the current user' })
  @ApiOkResponse({ type: ReminderResponseDto, isArray: true })
  @ApiBadRequestResponse({
    description: 'The authenticated user has no agent profile',
  })
  all(@Query() filters: ListRemindersDto, @CurrentUser() user: User) {
    return this.service
      .findAll(filters, user)
      .then((items) => items.map(this.toResponse));
  }
  @Patch(':id')
  @Roles(...WRITE)
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
  @Roles(...WRITE)
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
  @Roles(...WRITE)
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
