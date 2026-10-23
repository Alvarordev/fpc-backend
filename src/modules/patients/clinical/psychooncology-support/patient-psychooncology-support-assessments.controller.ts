import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '../../../../database/entities/user-role.enum';
import { User } from '../../../../database/entities/user.entity';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { PatientPsychooncologySupportAssessmentResponseDto } from './dto/patient-psychooncology-support-assessment-response.dto';
import { PatientPsychooncologySupportAssessmentsService } from './patient-psychooncology-support-assessments.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];

@Controller('patients/:patientId/psychooncology-support-assessments')
@ApiTags('Patient psycho-oncology support assessments')
@ApiBearerAuth()
export class PatientPsychooncologySupportAssessmentsController {
  constructor(
    private readonly service: PatientPsychooncologySupportAssessmentsService,
  ) {}

  @Get()
  @Roles(...READ)
  @ApiOperation({ summary: 'List patient psycho-oncology support assessments' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({
    type: PatientPsychooncologySupportAssessmentResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async findAll(
    @Param('patientId') patientId: string,
    @CurrentUser() user: User,
  ): Promise<PatientPsychooncologySupportAssessmentResponseDto[]> {
    return (await this.service.findAll(patientId, user)).map((assessment) =>
      PatientPsychooncologySupportAssessmentResponseDto.from(assessment),
    );
  }
}
