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
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import {
  RecurringAvailabilityResponseDto,
  RemoveRecurrenceResponseDto,
} from './dto/recurring-availability-response.dto';
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

  @Post('recurring')
  @Roles(...ACCESS)
  @ApiOperation({
    summary: 'Create a weekly availability block split into 1-hour slots',
  })
  @ApiParam({ name: 'volunteerId', format: 'uuid' })
  @ApiCreatedResponse({ type: RecurringAvailabilityResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid range, days, or hours' })
  @ApiConflictResponse({ description: 'Volunteer is inactive' })
  @ApiForbiddenResponse({
    description: 'Volunteers can only manage their own availability',
  })
  @ApiNotFoundResponse({ description: 'Volunteer not found' })
  async createRecurring(
    @Param('volunteerId') volunteerId: string,
    @Body() dto: CreateRecurringAvailabilityDto,
    @CurrentUser() user: User,
  ): Promise<RecurringAvailabilityResponseDto> {
    const result = await this.service.createRecurring(volunteerId, dto, user);
    return { ...result, created: result.created.map(this.toResponse) };
  }

  @Delete('recurrences/:recurrenceId')
  @Roles(...ACCESS)
  @ApiOperation({
    summary: 'Remove the free future slots of a recurring block',
  })
  @ApiParam({ name: 'volunteerId', format: 'uuid' })
  @ApiParam({ name: 'recurrenceId', format: 'uuid' })
  @ApiOkResponse({ type: RemoveRecurrenceResponseDto })
  @ApiForbiddenResponse({
    description: 'Volunteers can only manage their own availability',
  })
  @ApiNotFoundResponse({ description: 'Volunteer or recurrence not found' })
  removeRecurrence(
    @Param('volunteerId') volunteerId: string,
    @Param('recurrenceId') recurrenceId: string,
    @CurrentUser() user: User,
  ): Promise<RemoveRecurrenceResponseDto> {
    return this.service.removeRecurrence(recurrenceId, volunteerId, user);
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
      recurrenceId: item.recurrenceId,
      isHistorical: item.isHistorical,
      createdAt: item.createdAt,
    };
  }
}
