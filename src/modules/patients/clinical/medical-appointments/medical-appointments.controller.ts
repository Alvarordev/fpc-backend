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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../../database/entities/user-role.enum';
import { User } from '../../../../database/entities/user.entity';
import {
  MedicalAppointmentListResponseDto,
  MedicalAppointmentResponseDto,
} from './dto/medical-appointment-response.dto';
import { CreateMedicalAppointmentDto } from './dto/create-medical-appointment.dto';
import { FindMedicalAppointmentsDto } from './dto/list-medical-appointments.dto';
import { UpdateMedicalAppointmentDto } from './dto/update-medical-appointment.dto';
import { MedicalAppointmentsService } from './medical-appointments.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('medical-appointments')
@ApiTags('Medical appointments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class MedicalAppointmentsController {
  constructor(private readonly service: MedicalAppointmentsService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({
    summary: 'Create a standalone medical appointment',
    description:
      "Reuses the patient's most recent follow-up if one exists, otherwise creates a minimal one.",
  })
  @ApiCreatedResponse({ type: MedicalAppointmentResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid payload, or the authenticated user has no agent profile',
  })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async create(
    @Body() dto: CreateMedicalAppointmentDto,
    @CurrentUser() user: User,
  ): Promise<MedicalAppointmentResponseDto> {
    return MedicalAppointmentResponseDto.from(
      await this.service.create(dto, user),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({
    summary: 'List medical appointments across all patients',
    description:
      'Returns only current (non-superseded) appointments by default. Volunteers only see appointments for patients they are assigned to.',
  })
  @ApiOkResponse({ type: MedicalAppointmentListResponseDto })
  @ApiForbiddenResponse()
  async findAll(
    @Query() filters: FindMedicalAppointmentsDto,
    @CurrentUser() user: User,
  ): Promise<MedicalAppointmentListResponseDto> {
    const { data, total } = await this.service.findAll(filters, user);
    return {
      data: data.map((appointment) =>
        MedicalAppointmentResponseDto.from(appointment),
      ),
      total,
    };
  }

  @Patch(':id')
  @Roles(...WRITE)
  @ApiOperation({
    summary: 'Update a medical appointment',
    description:
      'Creates a new current version and marks the previous one as superseded; the returned id differs from the path id. specialty cannot be changed — create a new appointment instead. changeReason is required.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MedicalAppointmentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Medical appointment not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMedicalAppointmentDto,
  ): Promise<MedicalAppointmentResponseDto> {
    return MedicalAppointmentResponseDto.from(
      await this.service.update(id, dto),
    );
  }
}
