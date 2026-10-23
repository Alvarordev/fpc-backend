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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { Roles } from '../../../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../../../database/entities/user-role.enum';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';
import { User } from '../../../../../database/entities/user.entity';
import { CreateTreatmentMedicationDto } from './create-treatment-medication.dto';
import { UpdateTreatmentMedicationDto } from './update-treatment-medication.dto';
import { TreatmentMedicationResponseDto } from './treatment-medication-response.dto';
import { TreatmentMedicationsService } from './treatment-medications.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/treatments/:treatmentId/medications')
@ApiTags('Treatment medications')
@ApiBearerAuth()
export class TreatmentMedicationsController {
  constructor(private readonly service: TreatmentMedicationsService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Add a medication to a treatment' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'treatmentId', format: 'uuid' })
  @ApiCreatedResponse({ type: TreatmentMedicationResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Treatment not found' })
  async create(
    @Param('patientId') patientId: string,
    @Param('treatmentId') treatmentId: string,
    @Body() dto: CreateTreatmentMedicationDto,
  ): Promise<TreatmentMedicationResponseDto> {
    return TreatmentMedicationResponseDto.from(
      await this.service.create(patientId, treatmentId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List medications for a treatment' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'treatmentId', format: 'uuid' })
  @ApiOkResponse({ type: TreatmentMedicationResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
    @Param('treatmentId') treatmentId: string,
    @CurrentUser() user: User,
  ): Promise<TreatmentMedicationResponseDto[]> {
    return (await this.service.findAll(patientId, treatmentId, user)).map(
      (medication) => TreatmentMedicationResponseDto.from(medication),
    );
  }

  @Patch(':medicationId')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Update a treatment medication' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'treatmentId', format: 'uuid' })
  @ApiParam({ name: 'medicationId', format: 'uuid' })
  @ApiOkResponse({ type: TreatmentMedicationResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Medication not found' })
  async update(
    @Param('patientId') patientId: string,
    @Param('treatmentId') treatmentId: string,
    @Param('medicationId') medicationId: string,
    @Body() dto: UpdateTreatmentMedicationDto,
  ): Promise<TreatmentMedicationResponseDto> {
    return TreatmentMedicationResponseDto.from(
      await this.service.update(patientId, treatmentId, medicationId, dto),
    );
  }

  @Delete(':medicationId')
  @Roles(...WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a treatment medication' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'treatmentId', format: 'uuid' })
  @ApiParam({ name: 'medicationId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Medication not found' })
  async deactivate(
    @Param('patientId') patientId: string,
    @Param('treatmentId') treatmentId: string,
    @Param('medicationId') medicationId: string,
  ): Promise<void> {
    await this.service.deactivate(patientId, treatmentId, medicationId);
  }
}
