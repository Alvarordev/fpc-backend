import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import { AppointmentStatus } from '../database/entities/psychooncology-appointment.entity';
import {
  CreatePsychooncologyAppointmentDto,
  UpdatePsychooncologyAppointmentDto,
} from './psychooncology-appointments.dto';
import { PsychooncologyAppointmentsService } from './psychooncology-appointments.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const SCHEDULE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('psychooncology-appointments')
export class PsychooncologyAppointmentsController {
  constructor(private readonly service: PsychooncologyAppointmentsService) {}

  @Post() @Roles(...SCHEDULE) create(
    @Body() dto: CreatePsychooncologyAppointmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(dto, user);
  }

  @Get() @Roles(...READ) findAll(@CurrentUser() user: User) {
    return this.service.findAll(user);
  }

  @Get(':id') @Roles(...READ) findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id') @Roles(...READ) update(
    @Param('id') id: string,
    @Body() dto: UpdatePsychooncologyAppointmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/cancel') @Roles(...SCHEDULE) cancel(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.update(
      id,
      { status: AppointmentStatus.CANCELLED },
      user,
    );
  }
}
