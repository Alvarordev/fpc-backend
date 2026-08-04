import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import { Alert } from '../database/entities/alert.entity';
import { AlertResponseDto } from './alert-response.dto';
import { CreateAlertDto, FindAlertsDto } from './alerts.dto';
import { AlertsService } from './alerts.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];

@Controller('alerts')
@ApiTags('alerts')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Post()
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: 'Create an alert' })
  @ApiCreatedResponse({ type: AlertResponseDto })
  @ApiBadRequestResponse({
    description: 'The authenticated user has no agent profile',
  })
  @ApiNotFoundResponse({
    description: 'Health center, follow-up, or patient not found',
  })
  create(@Body() dto: CreateAlertDto, @CurrentUser() user: User) {
    return this.service.create(dto, user).then(this.toResponse);
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List alerts' })
  @ApiOkResponse({ type: AlertResponseDto, isArray: true })
  findAll(@Query() filters: FindAlertsDto, @CurrentUser() user: User) {
    return this.service
      .findAll(filters, user)
      .then((items) => items.map(this.toResponse));
  }

  @Get(':id')
  @Roles(...READ)
  @ApiOperation({ summary: 'Get an alert' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user).then(this.toResponse);
  }

  @Patch(':id/resolve')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiBadRequestResponse({
    description: 'The authenticated user has no agent profile',
  })
  @ApiForbiddenResponse({ description: 'Administrator or agent role required' })
  @ApiConflictResponse({ description: 'Alert is already resolved' })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  resolve(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.resolve(id, user).then(this.toResponse);
  }

  private toResponse(this: void, alert: Alert): AlertResponseDto {
    return {
      id: alert.id,
      healthCenterId: alert.healthCenterId,
      healthCenterName: alert.healthCenter.name,
      followUpId: alert.followUpId,
      createdById: alert.createdById,
      createdByName: alert.createdBy.fullName,
      title: alert.title,
      description: alert.description,
      status: alert.status,
      resolvedAt: alert.resolvedAt,
      resolvedById: alert.resolvedById,
      resolvedByUserId: alert.resolvedByUserId,
      resolvedByName:
        alert.resolvedBy?.fullName ?? alert.resolvedByUser?.email ?? null,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }
}
