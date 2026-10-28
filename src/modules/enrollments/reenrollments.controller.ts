import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { AuditFollowUpParam } from '../../shared/audit/audit-context';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import {
  CreateReenrollmentDto,
  ReenrollmentResponseDto,
} from './dto/reenrollment.dto';
import { ReenrollmentsService } from './reenrollments.service';

@Controller('follow-ups/:id/reenrollment')
@ApiTags('follow-ups')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiParam({ name: 'id', format: 'uuid', description: 'Follow-up id' })
export class ReenrollmentsController {
  constructor(private readonly service: ReenrollmentsService) {}

  @Post()
  @AuditFollowUpParam('id')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT)
  @ApiOperation({
    summary: 'Re-enroll an inactive patient from a REENROLLMENT follow-up',
    description:
      'Stores reason, entry source and health situation, updates the health phase, reactivates the patient linked to the follow-up and marks it completed.',
  })
  @ApiCreatedResponse({ type: ReenrollmentResponseDto })
  @ApiForbiddenResponse({
    description: 'Agents can only use their own follow-ups',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el seguimiento.' })
  @ApiConflictResponse({
    description: 'Already re-enrolled, or the patient is not inactive',
  })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateReenrollmentDto,
    @CurrentUser() user: User,
  ): Promise<ReenrollmentResponseDto> {
    return this.service.create(id, input, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT)
  @ApiOperation({ summary: 'Get the re-enrollment recorded in a follow-up' })
  @ApiOkResponse({ type: ReenrollmentResponseDto })
  @ApiNotFoundResponse({ description: 'No reenrollment for this follow-up' })
  find(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ReenrollmentResponseDto> {
    return this.service.findForFollowUp(id, user);
  }
}
