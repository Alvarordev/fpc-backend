import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';
import { CreatePatientReferralDto } from './dto/create-patient-referral.dto';
import { PatientReferralResponseDto } from './dto/patient-referral-response.dto';
import { PatientReferralsService } from './patient-referrals.service';

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
export class PatientReferralsController {
  constructor(private readonly service: PatientReferralsService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a patient referral between health centers' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiCreatedResponse({ type: PatientReferralResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or health center not found' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientReferralDto,
  ): Promise<PatientReferralResponseDto> {
    return PatientReferralResponseDto.from(
      await this.service.create(patientId, dto),
    );
  }

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List a patient referral history' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: PatientReferralResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientReferralResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((referral) =>
      PatientReferralResponseDto.from(referral),
    );
  }
}
