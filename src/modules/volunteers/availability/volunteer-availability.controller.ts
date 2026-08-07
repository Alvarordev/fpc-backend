import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import { User } from '../../../database/entities/user.entity';
import { VolunteerAvailability } from '../../../database/entities/volunteer-availability.entity';
import { CreateVolunteerAvailabilityDto } from './dto/create-volunteer-availability.dto';
import { VolunteerAvailabilityResponseDto } from './dto/volunteer-availability-response.dto';
import { VolunteerAvailabilityService } from './volunteer-availability.service';

const ACCESS = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];

@Controller('volunteers/:volunteerId/availability')
@ApiTags('volunteer-availability')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class VolunteerAvailabilityController {
  constructor(private readonly service: VolunteerAvailabilityService) {}

  @Post()
  @Roles(...ACCESS)
  @ApiOperation({ summary: 'Create a volunteer availability slot' })
  @ApiParam({ name: 'volunteerId', format: 'uuid' })
  @ApiCreatedResponse({ type: VolunteerAvailabilityResponseDto })
  @ApiBadRequestResponse({ description: 'End time must be after start time' })
  @ApiConflictResponse({
    description: 'Volunteer is inactive or the slot overlaps an existing slot',
  })
  @ApiForbiddenResponse({
    description: 'Volunteers can only manage their own availability',
  })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  create(
    @Param('volunteerId') volunteerId: string,
    @Body() dto: CreateVolunteerAvailabilityDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(volunteerId, dto, user).then(this.toResponse);
  }

  @Get()
  @Roles(...ACCESS)
  @ApiOperation({ summary: 'List a volunteer availability slots' })
  @ApiParam({ name: 'volunteerId', format: 'uuid' })
  @ApiOkResponse({ type: VolunteerAvailabilityResponseDto, isArray: true })
  @ApiConflictResponse({ description: 'Volunteer is inactive' })
  @ApiForbiddenResponse({
    description: 'Volunteers can only view their own availability',
  })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  findAll(
    @Param('volunteerId') volunteerId: string,
    @CurrentUser() user: User,
  ) {
    return this.service
      .findAll(volunteerId, user)
      .then((items) => items.map(this.toResponse));
  }

  @Delete(':id')
  @Roles(...ACCESS)
  @ApiOperation({ summary: 'Remove a volunteer availability slot' })
  @ApiParam({ name: 'volunteerId', format: 'uuid' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Slot removed' })
  @ApiConflictResponse({
    description: 'Volunteer is inactive or availability is reserved',
  })
  @ApiForbiddenResponse({
    description: 'Volunteers can only manage their own availability',
  })
  @ApiNotFoundResponse({
    description: 'Volunteer or availability slot not found',
  })
  remove(
    @Param('id') id: string,
    @Param('volunteerId') volunteerId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.remove(id, volunteerId, user);
  }

  private toResponse(
    this: void,
    item: VolunteerAvailability,
  ): VolunteerAvailabilityResponseDto {
    return {
      id: item.id,
      volunteerId: item.volunteerId,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
      createdAt: item.createdAt,
    };
  }
}
