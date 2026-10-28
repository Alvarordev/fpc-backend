import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { ChangeLogQueryDto } from './dto/change-log-query.dto';
import { ChangeLogPageResponseDto } from './dto/change-log-response.dto';
import { PatientChangeLogService } from './patient-change-log.service';

@Controller('patients/:patientId/change-log')
@ApiTags('Patient change log')
@ApiBearerAuth()
export class PatientChangeLogController {
  constructor(private readonly service: PatientChangeLogService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT)
  @ApiOperation({
    summary: 'Field-level history of every change to the patient record',
  })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiOkResponse({ type: ChangeLogPageResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'No se encontró el paciente.' })
  findAll(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: ChangeLogQueryDto,
    @CurrentUser() user: User,
  ): Promise<ChangeLogPageResponseDto> {
    return this.service.findForPatient(patientId, query, user);
  }
}
