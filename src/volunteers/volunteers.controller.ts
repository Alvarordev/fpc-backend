import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
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
import { Roles } from '../shared/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { Volunteer } from '../database/entities/volunteer.entity';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { VolunteerResponseDto } from './dto/volunteer-response.dto';
import { VolunteersService } from './volunteers.service';

@Controller('volunteers')
@ApiBearerAuth()
@ApiTags('volunteers')
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a volunteer' })
  @ApiCreatedResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  create(@Body() input: CreateVolunteerDto) {
    return this.volunteersService.create(input).then(this.toResponse);
  }
  @Get()
  @ApiOperation({ summary: 'List volunteers' })
  @ApiOkResponse({ type: VolunteerResponseDto, isArray: true })
  findAll() {
    return this.volunteersService
      .findAll()
      .then((items) => items.map(this.toResponse));
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a volunteer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  findOne(@Param('id') id: string) {
    return this.volunteersService.findById(id).then(this.toResponse);
  }
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a volunteer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  update(@Param('id') id: string, @Body() input: UpdateVolunteerDto) {
    return this.volunteersService.update(id, input).then(this.toResponse);
  }
  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate a volunteer user account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  deactivate(@Param('id') id: string) {
    return this.volunteersService.deactivate(id).then(this.toResponse);
  }
  @Patch(':id/pause')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Pause a volunteer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  pause(@Param('id') id: string) {
    return this.volunteersService
      .setAvailability(id, false)
      .then(this.toResponse);
  }
  @Patch(':id/resume')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resume a volunteer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  resume(@Param('id') id: string) {
    return this.volunteersService
      .setAvailability(id, true)
      .then(this.toResponse);
  }

  private toResponse(this: void, volunteer: Volunteer): VolunteerResponseDto {
    return {
      id: volunteer.id,
      userId: volunteer.userId,
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      specialty: volunteer.specialty,
      email: volunteer.email,
      phone: volunteer.phone,
      isActive: volunteer.isActive,
      createdAt: volunteer.createdAt,
      updatedAt: volunteer.updatedAt,
    };
  }
}
