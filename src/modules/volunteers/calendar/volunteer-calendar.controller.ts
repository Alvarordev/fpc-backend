import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import {
  VolunteerCalendarQueryDto,
  VolunteerCalendarResponseDto,
} from './volunteer-calendar.dto';
import { VolunteerCalendarService } from './volunteer-calendar.service';

@Controller('volunteer-calendar')
@ApiTags('volunteer-calendar')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class VolunteerCalendarController {
  constructor(private readonly service: VolunteerCalendarService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.FOUNDATION)
  @ApiOperation({
    summary: 'Get volunteer availability and scheduled appointments',
  })
  @ApiOkResponse({ type: VolunteerCalendarResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid date range' })
  @ApiForbiddenResponse({
    description: 'Administrator, agent, or foundation role required',
  })
  findInRange(
    @Query() query: VolunteerCalendarQueryDto,
  ): Promise<VolunteerCalendarResponseDto> {
    return this.service.findInRange(query.from, query.to);
  }
}
