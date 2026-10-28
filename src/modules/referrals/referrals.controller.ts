import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import {
  CreateReferralDto,
  UpdateReferralDto,
} from './dto/create-referral.dto';
import { ReferralResponseDto } from './dto/referral-response.dto';
import { ReferralsService } from './referrals.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/referrals')
@ApiTags('Patient referrals')
@ApiBearerAuth()
@ApiParam({ name: 'patientId', format: 'uuid' })
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List patient referrals, newest first' })
  @ApiOkResponse({ type: ReferralResponseDto, isArray: true })
  @ApiForbiddenResponse({ description: 'Patient not assigned to volunteer' })
  @ApiNotFoundResponse({ description: 'No se encontró el paciente.' })
  async findAll(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: User,
  ) {
    return (await this.service.findAll(patientId, user, 'DESC')).map((item) =>
      ReferralResponseDto.from(item),
    );
  }

  @Get('route')
  @Roles(...READ)
  @ApiOperation({
    summary: "Patient's care route: referrals in chronological order",
  })
  @ApiOkResponse({ type: ReferralResponseDto, isArray: true })
  @ApiForbiddenResponse({ description: 'Patient not assigned to volunteer' })
  @ApiNotFoundResponse({ description: 'No se encontró el paciente.' })
  async route(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: User,
  ) {
    return (await this.service.findAll(patientId, user, 'ASC')).map((item) =>
      ReferralResponseDto.from(item),
    );
  }

  @Get(':id')
  @Roles(...READ)
  @ApiOperation({ summary: 'Get a patient referral' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReferralResponseDto })
  @ApiForbiddenResponse({ description: 'Patient not assigned to volunteer' })
  @ApiNotFoundResponse({ description: 'Patient or referral not found' })
  async findOne(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return ReferralResponseDto.from(
      await this.service.findOne(patientId, id, user),
    );
  }

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a patient referral' })
  @ApiCreatedResponse({ type: ReferralResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiForbiddenResponse({
    description: 'Administrator, foundation, or agent role required',
  })
  @ApiNotFoundResponse({
    description: 'Patient, health center, follow-up, or document not found',
  })
  async create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateReferralDto,
  ) {
    return ReferralResponseDto.from(await this.service.create(patientId, dto));
  }

  @Patch(':id')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Update a patient referral' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReferralResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiForbiddenResponse({
    description: 'Administrator, foundation, or agent role required',
  })
  @ApiNotFoundResponse({ description: 'Referral or reference not found' })
  async update(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReferralDto,
  ) {
    return ReferralResponseDto.from(
      await this.service.update(patientId, id, dto),
    );
  }

  @Delete(':id')
  @Roles(...WRITE)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a patient referral' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({
    description: 'Administrator, foundation, or agent role required',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la derivación.' })
  async remove(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.remove(patientId, id);
  }
}
