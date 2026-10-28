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
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { Volunteer } from '../../database/entities/volunteer.entity';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { VolunteerResponseDto } from './dto/volunteer-response.dto';
import { VolunteersService } from './volunteers.service';

const MANAGE = [UserRole.ADMIN, UserRole.FOUNDATION];

@Controller('volunteers')
@ApiBearerAuth()
@ApiTags('volunteers')
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}
  @Post()
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Create a volunteer' })
  @ApiCreatedResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  create(@Body() input: CreateVolunteerDto) {
    return this.volunteersService.create(input).then(this.toResponse);
  }
  @Get()
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT)
  @ApiOperation({ summary: 'List volunteers' })
  @ApiOkResponse({ type: VolunteerResponseDto, isArray: true })
  @ApiForbiddenResponse({ description: 'Volunteers cannot list volunteers' })
  findAll() {
    return this.volunteersService
      .findAll()
      .then((items) => items.map(this.toResponse));
  }
  @Get('me')
  @Roles(UserRole.VOLUNTEER)
  @ApiOperation({ summary: 'Get the profile of the authenticated volunteer' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  findMe(@CurrentUser() user: User) {
    return this.volunteersService.findByUser(user.id).then(this.toResponse);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a volunteer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({
    description: 'Volunteers can only view their own profile',
  })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.volunteersService.findVisible(id, user).then(this.toResponse);
  }
  @Patch(':id')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Update a volunteer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  update(@Param('id') id: string, @Body() input: UpdateVolunteerDto) {
    return this.volunteersService.update(id, input).then(this.toResponse);
  }
  @Patch(':id/deactivate')
  @Roles(...MANAGE)
  @ApiOperation({
    summary: 'Deactivate a volunteer user account',
    description:
      'Future sessions of the volunteer are flagged as needing reassignment.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  deactivate(@Param('id') id: string) {
    return this.volunteersService.deactivate(id).then(this.toResponse);
  }
  @Patch(':id/pause')
  @Roles(...MANAGE)
  @ApiOperation({
    summary: 'Pause a volunteer',
    description:
      'Future sessions of the volunteer are flagged as needing reassignment.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  pause(@Param('id') id: string) {
    return this.volunteersService
      .setAvailability(id, false)
      .then(this.toResponse);
  }
  @Patch(':id/resume')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Resume a volunteer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
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
      birthDate: volunteer.birthDate,
      commitmentStartAt: volunteer.commitmentStartAt,
      commitmentEndAt: volunteer.commitmentEndAt,
      hasVolunteerCertificate: volunteer.hasVolunteerCertificate,
      additionalComments: volunteer.additionalComments,
      completedSustainabilityModule: volunteer.completedSustainabilityModule,
      completedDesignThinkingModule: volunteer.completedDesignThinkingModule,
      isActive: volunteer.isActive,
      isAnonymous: volunteer.isAnonymous,
      createdAt: volunteer.createdAt,
      updatedAt: volunteer.updatedAt,
    };
  }
}
