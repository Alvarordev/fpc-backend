import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
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
  @Post() @Roles(...ROLES) create(@Body() dto: CreateReminderDto) {
    return this.service.create(dto);
  }
  @Get() @Roles(...ROLES) all() {
    return this.service.findAll();
  }
  @Patch(':id') @Roles(...ROLES) update(
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.service.update(id, dto);
  }
  @Patch(':id/complete') @Roles(...ROLES) complete(
    @Param('id') id: string,
    @Body() dto: CompleteReminderDto,
  ) {
    return this.service.complete(id, dto);
  }
  @Patch(':id/dismiss') @Roles(...ROLES) dismiss(@Param('id') id: string) {
    return this.service.dismiss(id);
  }
}
