import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../database/entities/user.entity';
import { CreateReminderDto } from '../reminders/reminders.dto';
import { CreateFollowUpDto, UpdateFollowUpDto } from './follow-ups.dto';
import { FollowUpsService } from './follow-ups.service';
const ROLES = ['ADMIN', 'FOUNDATION', 'AGENT'];
@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly service: FollowUpsService) {}
  @Post() @Roles(...ROLES) create(
    @Body() dto: CreateFollowUpDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(dto, user.id, user.role);
  }
  @Get(':id') @Roles(...ROLES) findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.findOneForUser(id, user.id, user.role);
  }
  @Patch(':id') @Roles(...ROLES) update(
    @Param('id') id: string,
    @Body() dto: UpdateFollowUpDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user.id, user.role);
  }
  @Post(':id/schedule-next') @Roles(...ROLES) next(
    @Param('id') id: string,
    @Body() dto: CreateFollowUpDto,
    @CurrentUser() user: User,
  ) {
    return this.service.scheduleNext(id, dto, user.id, user.role);
  }
  @Post(':id/reminders') @Roles(...ROLES) reminder(
    @Param('id') id: string,
    @Body() dto: CreateReminderDto,
    @CurrentUser() user: User,
  ) {
    return this.service.createReminder(id, dto, user.id, user.role);
  }
}
