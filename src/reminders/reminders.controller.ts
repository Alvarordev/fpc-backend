import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import {
  CreateReminderDto,
  CompleteReminderDto,
  UpdateReminderDto,
} from './reminders.dto';
import { RemindersService } from './reminders.service';
const ROLES = ['ADMIN', 'FOUNDATION', 'AGENT'];
@Controller('reminders')
export class RemindersController {
  constructor(private readonly service: RemindersService) {}
  @Post() @Roles(...ROLES) create(
    @Body() dto: CreateReminderDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(dto, user);
  }
  @Get() @Roles(...ROLES) all(@CurrentUser() user: User) {
    return this.service.findAll(user);
  }
  @Patch(':id') @Roles(...ROLES) update(
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user);
  }
  @Patch(':id/complete') @Roles(...ROLES) complete(
    @Param('id') id: string,
    @Body() dto: CompleteReminderDto,
    @CurrentUser() user: User,
  ) {
    return this.service.complete(id, dto, user);
  }
  @Patch(':id/dismiss') @Roles(...ROLES) dismiss(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.dismiss(id, user);
  }
}
