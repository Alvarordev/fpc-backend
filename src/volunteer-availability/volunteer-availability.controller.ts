import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import { CreateVolunteerAvailabilityDto } from './volunteer-availability.dto';
import { VolunteerAvailabilityService } from './volunteer-availability.service';

const ACCESS = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];

@Controller('volunteers/:volunteerId/availability')
export class VolunteerAvailabilityController {
  constructor(private readonly service: VolunteerAvailabilityService) {}

  @Post() @Roles(...ACCESS) create(
    @Param('volunteerId') volunteerId: string,
    @Body() dto: CreateVolunteerAvailabilityDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(volunteerId, dto, user);
  }

  @Get() @Roles(...ACCESS) findAll(
    @Param('volunteerId') volunteerId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.findAll(volunteerId, user);
  }

  @Delete(':id') @Roles(...ACCESS) remove(
    @Param('id') id: string,
    @Param('volunteerId') volunteerId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.remove(id, volunteerId, user);
  }
}
