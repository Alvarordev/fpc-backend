import { Body, Controller, Get, Post } from '@nestjs/common';
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
import { UserRole } from '../../database/entities/user-role.enum';
import { CallCenterWorkloadResponseDto } from './dto/call-center-response.dto';
import {
  ReassignFollowUpsDto,
  ReassignFollowUpsResponseDto,
} from './dto/reassign-follow-ups.dto';
import { CallCenterService } from './call-center.service';

@Controller('call-center')
@ApiTags('call-center')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class CallCenterController {
  constructor(private readonly service: CallCenterService) {}

  @Get('workload')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({
    summary: 'Get pending call center workload',
    description:
      'Pending follow-ups and reminders, with per-agent counts for today, this week and overdue.',
  })
  @ApiOkResponse({ type: CallCenterWorkloadResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  workload() {
    return this.service.workload();
  }

  @Post('reassign')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({ summary: 'Reassign pending follow-ups to another agent' })
  @ApiCreatedResponse({ type: ReassignFollowUpsResponseDto })
  @ApiBadRequestResponse({
    description: 'A follow-up is not scheduled or overdue',
  })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  @ApiNotFoundResponse({ description: 'Agent or follow-up not found' })
  reassign(
    @Body() dto: ReassignFollowUpsDto,
  ): Promise<ReassignFollowUpsResponseDto> {
    return this.service.reassign(dto);
  }
}
