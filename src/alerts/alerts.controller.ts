import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Public } from '../shared/decorators/public.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import { Alert } from '../database/entities/alert.entity';
import { AlertEvent } from '../database/entities/alert-event.entity';
import { AlertResponseDto } from './alert-response.dto';
import {
  AlertEventResponseDto,
  AlertTicketLookupResponseDto,
} from './alert-event-response.dto';
import {
  CreateAlertDto,
  CreateAlertEventDto,
  FindAlertsDto,
  UpdateAlertDto,
} from './alerts.dto';
import { AlertsService } from './alerts.service';
import { AlertSummaryService } from './alert-summary.service';

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
  constructor(
    private readonly service: AlertsService,
    private readonly summaryService: AlertSummaryService,
  ) {}

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

  // Must be declared before `:id` so Nest doesn't route "ticket" as an id.
  @Get('ticket/:ticketNumber')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Look up an alert by ticket number (WhatsApp bot tracking)',
    description:
      'Unauthenticated on purpose so the WhatsApp bot can resolve a ticket for the patient who reported it. Returns patient name, DNI, and phone number without requiring a session — do not link this from anywhere a bystander could reach.',
  })
  @ApiParam({ name: 'ticketNumber' })
  @ApiOkResponse({ type: AlertTicketLookupResponseDto })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  async findByTicket(@Param('ticketNumber') ticketNumber: string) {
    const alert = await this.service.findByTicket(ticketNumber);
    const events = await this.service.findEventsForAlert(alert.id);
    return {
      alert: this.toResponse(alert),
      events: events.map(this.toEventResponse),
      totalTimelineEvents: events.length,
    };
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

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.FOUNDATION)
  @ApiOperation({
    summary: 'Update an alert',
    description:
      'Patch semantics: omitted fields are left unchanged. Explicit null is only accepted for derivedTo and derivationNotes. Use PATCH /alerts/:id/resolve to resolve an alert — setting status to RESOLVED here is rejected.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiBadRequestResponse({
    description:
      'A non-nullable field was set to null, or status was set to RESOLVED',
  })
  @ApiForbiddenResponse({
    description: 'Administrator, agent, or foundation role required',
  })
  @ApiNotFoundResponse({
    description: 'Alert, health center, or follow-up not found',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user).then(this.toResponse);
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

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an alert' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user);
  }

  @Get(':id/events')
  @Roles(...READ)
  @ApiOperation({ summary: 'List an alert timeline events' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertEventResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  findEvents(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service
      .findEvents(id, user)
      .then((items) => items.map(this.toEventResponse));
  }

  @Post(':id/events')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.FOUNDATION)
  @ApiOperation({
    summary: 'Add a comment event to an alert timeline',
    description: 'The event type is always COMMENT; it cannot be set.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: AlertEventResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator, agent, or foundation role required',
  })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  addEvent(
    @Param('id') id: string,
    @Body() dto: CreateAlertEventDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .addEvent(id, dto, user)
      .then((event) => this.toEventResponse(event));
  }

  @Post(':id/ai-summary')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate an executive summary for an alert',
    description:
      'Deterministic Spanish template, not a model call. Re-running overwrites the stored summary and appends another AI_SUMMARY_GENERATED timeline event.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator or agent role required' })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  async aiSummary(@Param('id') id: string, @CurrentUser() user: User) {
    await this.summaryService.generate(id);
    return this.service.findOne(id, user).then(this.toResponse);
  }

  private toResponse(this: void, alert: Alert): AlertResponseDto {
    return {
      id: alert.id,
      ticketNumber: alert.ticketNumber,
      healthCenterId: alert.healthCenterId,
      healthCenterName: alert.healthCenter.name,
      followUpId: alert.followUpId,
      createdById: alert.createdById,
      createdByName: alert.createdBy.fullName,
      patientId: alert.followUp.subjectPatientId,
      patientFullName: alert.followUp.subjectPatient.fullName,
      patientDni: alert.followUp.subjectPatient.dni,
      patientPhone: alert.followUp.subjectPatient.primaryPhone,
      title: alert.title,
      description: alert.description,
      status: alert.status,
      severity: alert.severity,
      category: alert.category,
      underReview: alert.underReview,
      derivedTo: alert.derivedTo,
      derivationNotes: alert.derivationNotes,
      aiSummary: alert.aiSummary,
      resolvedAt: alert.resolvedAt,
      resolvedById: alert.resolvedById,
      resolvedByUserId: alert.resolvedByUserId,
      resolvedByName:
        alert.resolvedBy?.fullName ?? alert.resolvedByUser?.email ?? null,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }

  private toEventResponse(
    this: void,
    event: AlertEvent,
  ): AlertEventResponseDto {
    return {
      id: event.id,
      alertId: event.alertId,
      agentId: event.agentId,
      agentName: event.agent?.fullName ?? null,
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      createdAt: event.createdAt,
    };
  }
}
