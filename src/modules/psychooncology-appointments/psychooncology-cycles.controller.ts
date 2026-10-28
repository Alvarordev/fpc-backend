import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { ClosePsychooncologyCycleDto } from './dto/close-psychooncology-cycle.dto';
import { FindPsychooncologyCyclesQueryDto } from './dto/list-psychooncology-cycles.dto';
import { PsychooncologyCycleResponseDto } from './dto/psychooncology-cycle-response.dto';
import { PsychooncologyCyclesService } from './psychooncology-cycles.service';

@Controller('psychooncology-cycles')
@ApiTags('psychooncology-cycles')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class PsychooncologyCyclesController {
  constructor(private readonly service: PsychooncologyCyclesService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.FOUNDATION,
    UserRole.AGENT,
    UserRole.VOLUNTEER,
  )
  @ApiOperation({ summary: 'List the psycho-oncology cycles of a patient' })
  @ApiOkResponse({ type: PsychooncologyCycleResponseDto, isArray: true })
  @ApiForbiddenResponse({ description: 'Patient is not accessible' })
  findAll(
    @Query() query: FindPsychooncologyCyclesQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.service.findByPatient(query.patientId, user);
  }

  @Patch(':id/close')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT)
  @ApiOperation({
    summary: 'Close a psycho-oncology cycle (completed, abandoned, not needed)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PsychooncologyCycleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid closing date' })
  @ApiConflictResponse({
    description: 'Cycle already closed or it still has scheduled sessions',
  })
  @ApiNotFoundResponse({ description: 'Cycle not found' })
  close(
    @Param('id') id: string,
    @Body() dto: ClosePsychooncologyCycleDto,
    @CurrentUser() user: User,
  ) {
    return this.service.close(id, dto, user);
  }
}
