import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { VolunteersService } from './volunteers.service';

@Controller('volunteers')
@ApiBearerAuth()
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}
  @Post() @Roles(UserRole.ADMIN) create(@Body() input: CreateVolunteerDto) {
    return this.volunteersService.create(input);
  }
  @Get() findAll() {
    return this.volunteersService.findAll();
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.volunteersService.findById(id);
  }
  @Patch(':id') @Roles(UserRole.ADMIN) update(
    @Param('id') id: string,
    @Body() input: UpdateVolunteerDto,
  ) {
    return this.volunteersService.update(id, input);
  }
  @Patch(':id/deactivate') @Roles(UserRole.ADMIN) deactivate(
    @Param('id') id: string,
  ) {
    return this.volunteersService.deactivate(id);
  }
  @Patch(':id/pause') @Roles(UserRole.ADMIN) pause(@Param('id') id: string) {
    return this.volunteersService.setAvailability(id, false);
  }
  @Patch(':id/resume') @Roles(UserRole.ADMIN) resume(@Param('id') id: string) {
    return this.volunteersService.setAvailability(id, true);
  }
}
