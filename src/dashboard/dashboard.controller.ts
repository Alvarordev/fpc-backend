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
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { DashboardQueryDto, DashboardResponseDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@ApiTags('dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({
    summary:
      'Get aggregated dashboard analytics for a Lima calendar month or year',
  })
  @ApiOkResponse({ type: DashboardResponseDto })
  @ApiBadRequestResponse({
    description: 'The period, year, month, or timezone is invalid',
  })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  getDashboard(
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    return this.service.getDashboard(query);
  }
}
