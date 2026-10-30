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
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { Alert } from '../../database/entities/alert.entity';
import { AlertEvent } from '../../database/entities/alert-event.entity';
import { AlertResponseDto } from './dto/alert-response.dto';
import {
  AlertEventResponseDto,
  AlertTicketLookupResponseDto,
} from './dto/alert-event-response.dto';
import { CreateAlertDto } from './dto/create-alert.dto';
import { CreateAlertEventDto } from './dto/create-alert-event.dto';
import { FindAlertsDto } from './dto/list-alerts.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { ResolveAlertDto } from './dto/resolve-alert.dto';
import { DeriveAlertDto } from './dto/derive-alert.dto';
import { LinkAlertReportDto } from './dto/link-alert-report.dto';
import {
  AlertAffectedPatientsResponseDto,
  AlertNotifyPatientsResponseDto,
  AlertReportResponseDto,
} from './dto/alert-report-response.dto';
import { AlertReport } from '../../database/entities/alert-report.entity';
import { alertResolverName } from './alert-messages';
import { AlertsService } from './alerts.service';
import { AlertSummaryService } from './alert-summary.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const MANAGE = [UserRole.ADMIN, UserRole.AGENT, UserRole.FOUNDATION];

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
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
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
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user).then(this.toResponse);
  }

  @Patch(':id')
  @Roles(...MANAGE)
  @ApiOperation({
    summary: 'Update an alert',
    description:
      'Patch semantics: omitted fields are left unchanged; null is rejected. status moves between REPORTED and IN_REVIEW (recorded in the timeline). Use /resolve and /derive for those actions.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiBadRequestResponse({
    description:
      'A field was set to null or the category is not in the catalog',
  })
  @ApiConflictResponse({ description: 'La alerta ya está resuelta.' })
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
  @Roles(UserRole.FOUNDATION)
  @ApiOperation({
    summary: 'Resolve an alert, recording the procedure followed',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiBadRequestResponse({ description: 'resolutionNotes is required' })
  @ApiForbiddenResponse({ description: 'Esta acción la puede hacer solo la fundación.' })
  @ApiConflictResponse({ description: 'La alerta ya está resuelta.' })
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveAlertDto,
    @CurrentUser() user: User,
  ) {
    return this.service.resolve(id, dto, user).then(this.toResponse);
  }

  @Patch(':id/derive')
  @Roles(...MANAGE)
  @ApiOperation({
    summary: 'Derive an alert to an external entity (catalog) with a note',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiBadRequestResponse({
    description: 'The entity is not in the alert_derivation_entity catalog',
  })
  @ApiConflictResponse({ description: 'La alerta ya está resuelta.' })
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
  derive(
    @Param('id') id: string,
    @Body() dto: DeriveAlertDto,
    @CurrentUser() user: User,
  ) {
    return this.service.derive(id, dto, user).then(this.toResponse);
  }

  @Get(':id/reports')
  @Roles(...READ)
  @ApiOperation({ summary: 'List the patient reports linked to an alert' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertReportResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
  findReports(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service
      .findReports(id, user)
      .then((items) => items.map(this.toReportResponse));
  }

  @Post(':id/reports')
  @Roles(...MANAGE)
  @ApiOperation({
    summary: 'Link another patient report (follow-up) to an existing alert',
    description:
      'Pass followUpId, or subjectPatientId to create a completed follow-up (agents only).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: AlertReportResponseDto })
  @ApiBadRequestResponse({
    description: 'Neither followUpId nor subjectPatientId was provided',
  })
  @ApiConflictResponse({
    description: 'Alert is resolved or the follow-up is already linked',
  })
  @ApiNotFoundResponse({ description: 'Alert, follow-up or patient not found' })
  linkReport(
    @Param('id') id: string,
    @Body() dto: LinkAlertReportDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .linkReport(id, dto, user)
      .then((report) => this.toReportResponse(report));
  }

  @Get(':id/affected-patients')
  @Roles(...MANAGE)
  @ApiOperation({
    summary:
      'Patients with an ongoing (EN_PROCESO) treatment at the alert hospital, with a message ready to copy',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertAffectedPatientsResponseDto })
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
  affectedPatients(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<AlertAffectedPatientsResponseDto> {
    return this.service
      .affectedPatients(id, user)
      .then(({ response }) => response);
  }

  @Post(':id/affected-patients/notify')
  @Roles(...MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email the alert notice to affected patients that have an email',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertNotifyPatientsResponseDto })
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
  notifyAffectedPatients(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<AlertNotifyPatientsResponseDto> {
    return this.service.notifyAffectedPatients(id, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an alert' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Esta acción la puede hacer solo un administrador.' })
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user);
  }

  @Get(':id/events')
  @Roles(...READ)
  @ApiOperation({ summary: 'List an alert timeline events' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertEventResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
  findEvents(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service
      .findEvents(id, user)
      .then((items) => items.map(this.toEventResponse));
  }

  @Post(':id/events')
  @Roles(...MANAGE)
  @ApiOperation({
    summary: 'Add a comment event to an alert timeline',
    description: 'The event type is always COMMENT; it cannot be set.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: AlertEventResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator, agent, or foundation role required',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
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
  @Roles(...MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate an executive summary for an alert',
    description:
      'Deterministic Spanish template, not a model call. Re-running overwrites the stored summary and appends another AI_SUMMARY_GENERATED timeline event.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator, agent, or foundation role required',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la alerta.' })
  async aiSummary(@Param('id') id: string, @CurrentUser() user: User) {
    await this.service.findOne(id, user);
    await this.summaryService.generate(id, user);
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
      categoryLabel: alert.categoryItem?.label ?? null,
      derivedTo: alert.derivedTo,
      derivedToLabel: alert.derivedToItem?.label ?? alert.derivedTo,
      derivationNotes: alert.derivationNotes,
      derivedAt: alert.derivedAt,
      resolutionNotes: alert.resolutionNotes,
      reportsCount: alert.reportsCount ?? 0,
      aiSummary: alert.aiSummary,
      resolvedAt: alert.resolvedAt,
      resolvedByUserId: alert.resolvedByUserId,
      resolvedByName: alertResolverName(alert),
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
      actorUserId: event.actorUserId,
      actorName: event.agent?.fullName ?? event.actorUser?.email ?? null,
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      createdAt: event.createdAt,
    };
  }

  private toReportResponse(
    this: void,
    report: AlertReport,
  ): AlertReportResponseDto {
    return {
      id: report.id,
      alertId: report.alertId,
      patientId: report.patientId,
      patientFullName: report.patient.fullName,
      followUpId: report.followUpId,
      reportedAt: report.reportedAt,
      reportedByUserId: report.reportedByUserId,
      reportedByEmail: report.reportedByUser?.email ?? null,
    };
  }
}
