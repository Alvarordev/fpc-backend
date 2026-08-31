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
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { DashboardIndicatorQueryDto } from './dto/dashboard-indicator-query.dto';
import {
  DashboardAbandonmentResponseDto,
  DashboardAdherenceResponseDto,
  DashboardDemographicsResponseDto,
  DashboardEpidemiologyResponseDto,
  DashboardManagementResponseDto,
  DashboardProductivityResponseDto,
} from './dto/dashboard-indicator-response.dto';
import { DashboardIndicatorsService } from './dashboard-indicators.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@ApiTags('dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly indicators: DashboardIndicatorsService,
  ) {}

  @Get('indicators/demographics')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({ summary: 'Get demographic dashboard indicators' })
  @ApiOkResponse({ type: DashboardDemographicsResponseDto })
  @ApiBadRequestResponse({
    description: 'The indicator period or timezone is invalid',
  })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  getDemographics(
    @Query() query: DashboardIndicatorQueryDto,
  ): Promise<DashboardDemographicsResponseDto> {
    return this.indicators.getDemographics(query);
  }


  @Get('indicators/management')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({ summary: 'Get SEPA management dashboard indicators' })
  @ApiOkResponse({ type: DashboardManagementResponseDto })
  @ApiBadRequestResponse({
    description: 'The indicator period or timezone is invalid',
  })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  getManagement(
    @Query() query: DashboardIndicatorQueryDto,
  ): Promise<DashboardManagementResponseDto> {
    return this.indicators.getManagement(query);
  }

  @Get('indicators/productivity')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({ summary: 'Get SEPA productivity dashboard indicators' })
  @ApiOkResponse({ type: DashboardProductivityResponseDto })
  @ApiBadRequestResponse({
    description: 'The indicator period or timezone is invalid',
  })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  getProductivity(
    @Query() query: DashboardIndicatorQueryDto,
  ): Promise<DashboardProductivityResponseDto> {
    return this.indicators.getProductivity(query);
  }

  @Get('indicators/adherence')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({ summary: 'Get SEPA adherence dashboard indicators' })
  @ApiOkResponse({ type: DashboardAdherenceResponseDto })
  @ApiBadRequestResponse({
    description: 'The indicator period or timezone is invalid',
  })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  getAdherence(
    @Query() query: DashboardIndicatorQueryDto,
  ): Promise<DashboardAdherenceResponseDto> {
    return this.indicators.getAdherence(query);
  }

  @Get('indicators/abandonment')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({ summary: 'Get SEPA abandonment dashboard indicators' })
  @ApiOkResponse({ type: DashboardAbandonmentResponseDto })
  @ApiBadRequestResponse({
    description: 'The indicator period or timezone is invalid',
  })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  getAbandonment(
    @Query() query: DashboardIndicatorQueryDto,
  ): Promise<DashboardAbandonmentResponseDto> {
    return this.indicators.getAbandonment(query);
  }

  @Get('indicators/epidemiology')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({ summary: 'Get epidemiological dashboard indicators' })
  @ApiOkResponse({ type: DashboardEpidemiologyResponseDto })
  @ApiBadRequestResponse({
    description: 'The indicator period or timezone is invalid',
  })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  getEpidemiology(
    @Query() query: DashboardIndicatorQueryDto,
  ): Promise<DashboardEpidemiologyResponseDto> {
    return this.indicators.getEpidemiology(query);
  }

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
