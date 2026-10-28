import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import {
  CreateTalkInterestDto,
  FindTalkInterestsDto,
  TalkInterestListResponseDto,
  TalkInterestResponseDto,
} from './dto/talk-interest.dto';
import { TalkInterestsService } from './talk-interests.service';

const ROLES = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller()
@ApiTags('talk-interests')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@Roles(...ROLES)
export class TalkInterestsController {
  constructor(private readonly service: TalkInterestsService) {}

  @Get('talk-interests')
  @ApiOperation({
    summary: 'List companions interested in prevention talks',
    description:
      'CH1. Filter by talk (catalog code) or by companion/patient name.',
  })
  @ApiOkResponse({ type: TalkInterestListResponseDto })
  findAll(
    @Query() filters: FindTalkInterestsDto,
    @CurrentUser() user: User,
  ): Promise<TalkInterestListResponseDto> {
    return this.service.findAll(filters, user);
  }

  @Get('patients/:id/talk-interests')
  @ApiOperation({ summary: "Talk interests of a patient's companions" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TalkInterestResponseDto, isArray: true })
  findForPatient(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<TalkInterestResponseDto[]> {
    return this.service.findForPatient(id, user);
  }

  @Post('patients/:id/companions/:companionId/talk-interests')
  @ApiOperation({ summary: 'Register a companion as interested in a talk' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'companionId', format: 'uuid' })
  @ApiCreatedResponse({ type: TalkInterestResponseDto })
  @ApiNotFoundResponse({
    description: 'Companion not linked, or follow-up not found',
  })
  @ApiConflictResponse({ description: 'Already interested in that talk' })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('companionId', ParseUUIDPipe) companionId: string,
    @Body() input: CreateTalkInterestDto,
    @CurrentUser() user: User,
  ): Promise<TalkInterestResponseDto> {
    return this.service.create(id, companionId, input, user);
  }

  @Delete('patients/:id/talk-interests/:interestId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a talk interest' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'interestId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Interest not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('interestId', ParseUUIDPipe) interestId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.service.remove(id, interestId, user);
  }
}
