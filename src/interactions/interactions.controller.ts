import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../database/entities/user.entity';
import { CreateReminderDto } from '../reminders/reminders.dto';
import { CreateInteractionDto, UpdateInteractionDto } from './interactions.dto';
import { InteractionsService } from './interactions.service';
const ROLES = ['ADMIN', 'FOUNDATION', 'AGENT'];
@Controller('interactions')
export class InteractionsController {
  constructor(private readonly service: InteractionsService) {}
  @Post() @Roles(...ROLES) create(
    @Body() dto: CreateInteractionDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(dto, user.id, user.role);
  }
  @Get(':id') @Roles(...ROLES) findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Patch(':id') @Roles(...ROLES) update(
    @Param('id') id: string,
    @Body() dto: UpdateInteractionDto,
  ) {
    return this.service.update(id, dto);
  }
  @Post(':id/schedule-next') @Roles(...ROLES) next(
    @Param('id') id: string,
    @Body() dto: CreateInteractionDto,
    @CurrentUser() user: User,
  ) {
    return this.service.scheduleNext(id, dto, user.id, user.role);
  }
  @Post(':id/reminders') @Roles(...ROLES) reminder(
    @Param('id') id: string,
    @Body() dto: CreateReminderDto,
  ) {
    return this.service.createReminder(id, dto);
  }
}
