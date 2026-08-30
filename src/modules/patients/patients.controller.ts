import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
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
  ApiExtraModels,
} from '@nestjs/swagger';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { LinkCompanionDto } from './dto/link-companion.dto';
import { UpdateCompanionLinkDto } from './dto/update-companion-link.dto';
import { DeactivatePatientDto } from './dto/deactivate-patient.dto';
import { ListPatientsDto } from './dto/list-patients.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpsertPatientDetailsDto } from './dto/upsert-patient-details.dto';
import {
  CompanionPatientResponseDto,
  PatientDetailsResponseDto,
  PatientDetailsWithSummaryResponseDto,
  PatientListResponseDto,
  PatientResponseDto,
  PatientSummaryResponseDto,
} from './dto/patient-response.dto';
import { PatientsService } from './patients.service';
import { PatientSummaryOnDemandService } from '../patient-summaries/patient-summary-on-demand.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { PatientTimelineService } from './patient-timeline.service';
import {
  FollowUpTimelineEventDto,
  PatientTimelineQueryDto,
  PatientTimelineOutcomeDto,
  PatientTimelineResponseDto,
  PsychooncologyAppointmentTimelineEventDto,
  ReminderTimelineEventDto,
  SocialNoteTimelineEventDto,
} from './dto/patient-timeline.dto';

const PATIENT_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const PATIENT_WRITE_ROLES = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
];
const COMPANION_CREATE_ROLES = [...PATIENT_WRITE_ROLES, UserRole.VOLUNTEER];

@Controller('patients')
@ApiTags('Patients')
@ApiBearerAuth()
@ApiExtraModels(
  FollowUpTimelineEventDto,
  PatientTimelineOutcomeDto,
  ReminderTimelineEventDto,
  PsychooncologyAppointmentTimelineEventDto,
  SocialNoteTimelineEventDto,
)
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly summaries: PatientSummaryOnDemandService,
    private readonly timeline: PatientTimelineService,
  ) {}

  @Post()
  @Roles(...PATIENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Create a patient' })
  @ApiCreatedResponse({ type: PatientResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async create(@Body() input: CreatePatientDto): Promise<PatientResponseDto> {
    return PatientResponseDto.from(await this.patientsService.create(input));
  }

  @Post(':id/companions')
  @Roles(...COMPANION_CREATE_ROLES)
  @ApiOperation({ summary: 'Create and link a companion to a patient' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiConflictResponse({ description: 'Patient cannot have companions' })
  async createCompanion(
    @Param('id') id: string,
    @Body() input: CreateCompanionDto,
    @CurrentUser() user: User,
  ): Promise<PatientResponseDto> {
    return PatientResponseDto.from(
      await this.patientsService.createCompanion(id, input, undefined, user),
    );
  }

  @Post(':id/companions/link')
  @Roles(...PATIENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Link an existing companion to a patient' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: CompanionPatientResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or companion not found' })
  @ApiConflictResponse({ description: 'Companion is already linked' })
  async linkCompanion(
    @Param('id') id: string,
    @Body() input: LinkCompanionDto,
  ): Promise<CompanionPatientResponseDto> {
    return CompanionPatientResponseDto.from(
      await this.patientsService.linkCompanion(id, input),
    );
  }

  @Patch(':id/companions/:linkId')
  @Roles(...PATIENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Update a companion link' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'linkId', format: 'uuid' })
  @ApiOkResponse({ type: CompanionPatientResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or companion link not found' })
  async updateCompanionLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @Body() input: UpdateCompanionLinkDto,
  ): Promise<CompanionPatientResponseDto> {
    return CompanionPatientResponseDto.from(
      await this.patientsService.updateCompanionLink(id, linkId, input),
    );
  }

  @Get(':id/companions')
  @Roles(...PATIENT_READ_ROLES)
  @ApiOperation({ summary: 'List companions linked to a patient' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CompanionPatientResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async companions(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<CompanionPatientResponseDto[]> {
    return (await this.patientsService.findCompanions(id, user)).map((link) =>
      CompanionPatientResponseDto.from(link),
    );
  }

  @Get(':id/accompanies')
  @Roles(...PATIENT_READ_ROLES)
  @ApiOperation({ summary: 'List patients linked to a companion' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CompanionPatientResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async accompanies(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<CompanionPatientResponseDto[]> {
    return (await this.patientsService.findAccompanies(id, user)).map((link) =>
      CompanionPatientResponseDto.from(link),
    );
  }

  @Get()
  @Roles(...PATIENT_READ_ROLES)
  @ApiOperation({ summary: 'List patients' })
  @ApiOkResponse({ type: PatientListResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Query() filters: ListPatientsDto,
    @CurrentUser() user: User,
  ): Promise<PatientListResponseDto> {
    return PatientListResponseDto.from(
      await this.patientsService.findAll(filters, user),
    );
  }

  @Get(':id/summary')
  @Roles(...PATIENT_READ_ROLES)
  @ApiOperation({
    summary: 'Get a patient summary',
    description:
      'Returns the stored summary if one is already ready; otherwise generates it. Does not call the provider again once a summary is ready.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PatientSummaryResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async summary(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<PatientSummaryResponseDto> {
    await this.patientsService.assertCanRead(id, user);
    return PatientSummaryResponseDto.from(await this.summaries.get(id));
  }

  @Post(':id/summary/refresh')
  @Roles(...PATIENT_READ_ROLES)
  @ApiOperation({
    summary: 'Regenerate a patient summary',
    description:
      'Always calls the provider again, even if a ready summary already exists.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PatientSummaryResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async refreshSummary(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<PatientSummaryResponseDto> {
    await this.patientsService.assertCanRead(id, user);
    return PatientSummaryResponseDto.from(await this.summaries.refresh(id));
  }

  @Get(':id/timeline')
  @Roles(...PATIENT_READ_ROLES)
  @ApiOperation({
    summary: 'Get a patient timeline',
    description:
      'Returns the complete visible history. Admin, foundation, and agent roles can read all patient events. Volunteers can read all events only when any psycho-oncology appointment assigns them to the patient; otherwise the endpoint returns 403.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PatientTimelineResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({
    description: 'Patient is not assigned to the volunteer',
  })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  timelineForPatient(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PatientTimelineQueryDto,
    @CurrentUser() user: User,
  ): Promise<PatientTimelineResponseDto> {
    return this.timeline.get(id, query, user);
  }

  @Get(':id')
  @Roles(...PATIENT_READ_ROLES)
  @ApiOperation({ summary: 'Get a patient' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PatientDetailsWithSummaryResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<PatientDetailsWithSummaryResponseDto> {
    return PatientDetailsWithSummaryResponseDto.from(
      await this.patientsService.findByIdForUser(id, user),
    );
  }

  @Patch(':id')
  @Roles(...PATIENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Update a patient' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PatientResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async update(
    @Param('id') id: string,
    @Body() input: UpdatePatientDto,
  ): Promise<PatientResponseDto> {
    return PatientResponseDto.from(
      await this.patientsService.update(id, input),
    );
  }

  @Patch(':id/deactivate')
  @Roles(...PATIENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Deactivate a patient' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PatientResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async deactivate(
    @Param('id') id: string,
    @Body() input: DeactivatePatientDto,
  ): Promise<PatientResponseDto> {
    return PatientResponseDto.from(
      await this.patientsService.deactivate(id, input),
    );
  }

  @Patch(':id/reactivate')
  @Roles(...PATIENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Reactivate a patient' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PatientResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async reactivate(@Param('id') id: string): Promise<PatientResponseDto> {
    return PatientResponseDto.from(await this.patientsService.reactivate(id));
  }

  @Put(':id/details')
  @Roles(...PATIENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Create or update patient details' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PatientDetailsResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiConflictResponse({
    description: 'Patient does not have the required role',
  })
  upsertDetails(
    @Param('id') id: string,
    @Body() input: UpsertPatientDetailsDto,
  ): Promise<PatientDetailsResponseDto> {
    return this.patientsService
      .upsertDetails(id, input)
      .then((details) => PatientDetailsResponseDto.from(details));
  }
}
