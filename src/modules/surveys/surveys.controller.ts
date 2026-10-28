import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { SurveyType } from '../../database/entities/survey.entity';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { ListSurveysDto } from './dto/list-surveys.dto';
import { SurveyScriptQueryDto } from './dto/survey-script-query.dto';
import {
  PendingThreeMonthSurveyDto,
  SurveyResponseDto,
  SurveyScriptResponseDto,
} from './dto/survey-response.dto';
import { SurveysService } from './surveys.service';

const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('surveys')
@ApiTags('surveys')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class SurveysController {
  constructor(private readonly service: SurveysService) {}

  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Record a satisfaction survey answer (1–5)' })
  @ApiCreatedResponse({ type: SurveyResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid survey link' })
  @ApiNotFoundResponse({
    description: 'Patient, follow-up or session not found',
  })
  create(
    @Body() dto: CreateSurveyDto,
    @CurrentUser() user: User,
  ): Promise<SurveyResponseDto> {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles(...WRITE, UserRole.VOLUNTEER)
  @ApiOperation({
    summary: 'List surveys. Volunteers only see psycho-oncology surveys.',
  })
  @ApiOkResponse({ type: SurveyResponseDto, isArray: true })
  findAll(
    @Query() filters: ListSurveysDto,
    @CurrentUser() user: User,
  ): Promise<SurveyResponseDto[]> {
    return this.service.findAll(
      filters,
      user.role === UserRole.VOLUNTEER ? SurveyType.PSYCHOONCOLOGY : undefined,
    );
  }

  @Get('script')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Get the survey message ready to copy' })
  @ApiOkResponse({ type: SurveyScriptResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  script(
    @Query() query: SurveyScriptQueryDto,
  ): Promise<SurveyScriptResponseDto> {
    return this.service.script(query);
  }

  @Get('pending/three-months')
  @Roles(...WRITE)
  @ApiOperation({
    summary:
      'Active patients enrolled 90 or more days ago without a three-month survey',
  })
  @ApiOkResponse({ type: PendingThreeMonthSurveyDto, isArray: true })
  @ApiForbiddenResponse({
    description: 'Volunteers cannot see pending surveys',
  })
  pendingThreeMonths(): Promise<PendingThreeMonthSurveyDto[]> {
    return this.service.pendingThreeMonths();
  }
}
