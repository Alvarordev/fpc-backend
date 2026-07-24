import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import { CreateAlertDto } from './alerts.dto';
import { AlertsService } from './alerts.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];

@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Post() @Roles(UserRole.AGENT) create(
    @Body() dto: CreateAlertDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(dto, user);
  }

  @Get() @Roles(...READ) findAll() {
    return this.service.findAll();
  }

  @Get(':id') @Roles(...READ) findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/resolve') @Roles(UserRole.AGENT) resolve(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.resolve(id, user);
  }
}
