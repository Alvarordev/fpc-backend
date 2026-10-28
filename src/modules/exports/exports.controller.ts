import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { ExportPatientsQueryDto } from './dto/export-patients-query.dto';
import { ExportsService } from './exports.service';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('exports')
@ApiTags('exports')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Get('patients')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({
    summary:
      'Export patients and their records to Excel, one sheet per entity, with the dashboard filters',
  })
  @ApiProduces(XLSX)
  @ApiOkResponse({ description: 'Excel workbook' })
  @ApiBadRequestResponse({ description: 'Invalid filters' })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  async exportPatients(
    @Query() query: ExportPatientsQueryDto,
    @CurrentUser() user: User,
  ): Promise<StreamableFile> {
    const { buffer, fileName } = await this.service.exportPatients(query, user);
    return new StreamableFile(buffer, {
      type: XLSX,
      disposition: `attachment; filename="${fileName}"`,
      length: buffer.length,
    });
  }
}
