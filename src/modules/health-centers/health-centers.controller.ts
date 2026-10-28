import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import {
  HEALTH_CENTER_CARE_LEVELS,
  HealthCenter,
} from '../../database/entities/health-center.entity';
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
  @ApiQuery({
    name: 'careLevel',
    required: false,
    enum: HEALTH_CENTER_CARE_LEVELS,
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false, enum: ['true', 'false'] })
  @ApiOkResponse({ type: HealthCenterResponseDto, isArray: true })
  findAll(
    @Query('department') department?: string,
    @Query('isActive') isActive?: string,
    @Query('careLevel') careLevel?: string,
    @Query('search') search?: string,
  ) {
    return this.service
      .findAll({
        department,
        isActive: isActive === undefined ? undefined : isActive === 'true',
        careLevel,
        search,
      })
      .then((items) => items.map(this.toResponse));
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a health center' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: HealthCenterResponseDto })
  @ApiNotFoundResponse({ description: 'Health center not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHealthCenterDto,
  ) {
    return this.service.update(id, dto).then(this.toResponse);
  }

  private toResponse(this: void, item: HealthCenter): HealthCenterResponseDto {
    return HealthCenterResponseDto.from(item);
  }
}
