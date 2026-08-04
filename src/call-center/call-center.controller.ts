import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { CallCenterWorkloadResponseDto } from './call-center.dto';
import { CallCenterService } from './call-center.service';

@Controller('call-center')
@ApiTags('call-center')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class CallCenterController {
  constructor(private readonly service: CallCenterService) {}

  @Get('workload')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pending call center workload' })
  @ApiOkResponse({ type: CallCenterWorkloadResponseDto })
  workload() {
    return this.service.workload();
  }
}
