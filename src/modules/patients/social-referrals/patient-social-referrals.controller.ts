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
import { CreatePatientSocialReferralDto } from './dto/create-patient-social-referral.dto';
import { CreatePatientSocialReferralUpdateDto } from './dto/create-patient-social-referral-update.dto';
import { PatientSocialReferralResponseDto } from './dto/patient-social-referral-response.dto';
import { PatientSocialReferralsService } from './patient-social-referrals.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('patients/:patientId/social-referrals')
@ApiTags('Patient social referrals')
@ApiBearerAuth()
export class PatientSocialReferralsController {
  constructor(private readonly service: PatientSocialReferralsService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Open a social referral for a patient' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientSocialReferralResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or follow-up not found' })
  async create(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body() dto: CreatePatientSocialReferralDto,
    @CurrentUser() user: User,
  ): Promise<PatientSocialReferralResponseDto> {
    return PatientSocialReferralResponseDto.from(
      await this.service.create(patientId, dto, user.id),
    );
  }

  @Post(':referralId/updates')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record the outcome of a social referral' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'referralId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientSocialReferralResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Referral or follow-up not found' })
  async addUpdate(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Param('referralId', new ParseUUIDPipe()) referralId: string,
    @Body() dto: CreatePatientSocialReferralUpdateDto,
    @CurrentUser() user: User,
  ): Promise<PatientSocialReferralResponseDto> {
    return PatientSocialReferralResponseDto.from(
      await this.service.addUpdate(patientId, referralId, dto, user.id),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List social referrals with their history' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientSocialReferralResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async findAll(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientSocialReferralResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((referral) =>
      PatientSocialReferralResponseDto.from(referral),
    );
  }
}
