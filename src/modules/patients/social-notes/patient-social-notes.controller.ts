import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { UserRole } from '../../../database/entities/user-role.enum';
import { User } from '../../../database/entities/user.entity';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CreatePatientSocialNoteDto } from './dto/create-patient-social-note.dto';
import { PatientSocialNoteResponseDto } from './dto/patient-social-note-response.dto';
import { PatientSocialNotesService } from './patient-social-notes.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/social-notes')
@ApiTags('Patient social notes')
@ApiBearerAuth()
export class PatientSocialNotesController {
  constructor(private readonly service: PatientSocialNotesService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a patient social note' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientSocialNoteResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or follow-up not found' })
  async create(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body() dto: CreatePatientSocialNoteDto,
    @CurrentUser() user: User,
  ): Promise<PatientSocialNoteResponseDto> {
    return PatientSocialNoteResponseDto.from(
      await this.service.create(patientId, dto, user.id),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List patient social notes' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientSocialNoteResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async findAll(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientSocialNoteResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((note) =>
      PatientSocialNoteResponseDto.from(note),
    );
  }
}
