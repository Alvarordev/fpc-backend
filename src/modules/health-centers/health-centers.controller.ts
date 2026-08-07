import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { CreateHealthCenterDto } from './dto/create-health-center.dto';
import { UpdateHealthCenterDto } from './dto/update-health-center.dto';
import { HealthCenterResponseDto } from './dto/health-center-response.dto';
import { HealthCentersService } from './health-centers.service';
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('health-centers')
@ApiTags('health-centers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class HealthCentersController {
  constructor(private readonly service: HealthCentersService) {}
  @Post()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Create a health center' })
  @ApiCreatedResponse({ type: HealthCenterResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator, foundation, or agent role required',
  })
  create(@Body() dto: CreateHealthCenterDto) {
    return this.service.create(dto).then(this.toResponse);
  }
  @Get()
  @ApiOperation({ summary: 'List health centers' })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'isActive', required: false, enum: ['true', 'false'] })
  @ApiOkResponse({ type: HealthCenterResponseDto, isArray: true })
  findAll(
    @Query('department') department?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service
      .findAll(
        department,
        isActive === undefined ? undefined : isActive === 'true',
      )
      .then((items) => items.map(this.toResponse));
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a health center' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: HealthCenterResponseDto })
  @ApiNotFoundResponse({ description: 'Health center not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id).then(this.toResponse);
  }
  @Patch(':id')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Update a health center' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: HealthCenterResponseDto })
  @ApiForbiddenResponse({
    description: 'Administrator, foundation, or agent role required',
  })
  @ApiNotFoundResponse({ description: 'Health center not found' })
  update(@Param('id') id: string, @Body() dto: UpdateHealthCenterDto) {
    return this.service.update(id, dto).then(this.toResponse);
  }

  private toResponse(this: void, item: HealthCenter): HealthCenterResponseDto {
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      department: item.department,
      isActive: item.isActive,
      patientCount: item.patientCount ?? 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
