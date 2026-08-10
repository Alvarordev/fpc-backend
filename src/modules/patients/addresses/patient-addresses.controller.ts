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
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';
import { CreatePatientAddressDto } from './dto/create-patient-address.dto';
import { UpdatePatientAddressDto } from './dto/update-patient-address.dto';
import { PatientAddressResponseDto } from './dto/patient-address-response.dto';
import { PatientAddressesService } from './patient-addresses.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/addresses')
@ApiTags('Patient addresses')
@ApiBearerAuth()
export class PatientAddressesController {
  constructor(private readonly service: PatientAddressesService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Add a patient address' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientAddressResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientAddressDto,
  ): Promise<PatientAddressResponseDto> {
    return PatientAddressResponseDto.from(
      await this.service.create(patientId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List a patient addresses' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientAddressResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientAddressResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((address) =>
      PatientAddressResponseDto.from(address),
    );
  }

  @Patch(':addressId')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Update a patient address' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'addressId', format: 'uuid' })
  @ApiOkResponse({ type: PatientAddressResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Address not found' })
  async update(
    @Param('patientId') patientId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdatePatientAddressDto,
  ): Promise<PatientAddressResponseDto> {
    return PatientAddressResponseDto.from(
      await this.service.update(patientId, addressId, dto),
    );
  }

  @Delete(':addressId')
  @Roles(...WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a patient address' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'addressId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Address not found' })
  async deactivate(
    @Param('patientId') patientId: string,
    @Param('addressId') addressId: string,
  ): Promise<void> {
    await this.service.deactivate(patientId, addressId);
  }
}
