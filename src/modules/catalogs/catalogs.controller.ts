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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import {
  CATALOG_KINDS,
  type CatalogKind,
} from '../../database/entities/catalog-item.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CatalogsService } from './catalogs.service';
import { CatalogItemResponseDto } from './dto/catalog-item-response.dto';
import { CatalogMergeResponseDto } from './dto/catalog-merge-response.dto';
import {
  AuditContext,
  AuditContextKind,
} from '../../shared/audit/audit-context';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from './dto/create-catalog-item.dto';
import { UbigeoTreeResponseDto } from './dto/ubigeo-response.dto';

class ListCatalogsQuery {
  @IsOptional()
  @IsIn(CATALOG_KINDS)
  kind?: CatalogKind;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  includeInactive?: boolean;
}

class UbigeoQuery {
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  province?: string;
}

@Controller('catalogs')
@ApiTags('catalogs')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class CatalogsController {
  constructor(private readonly service: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'List catalog items' })
  @ApiQuery({ name: 'kind', required: false, enum: CATALOG_KINDS })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiOkResponse({ type: CatalogItemResponseDto, isArray: true })
  findAll(@Query() query: ListCatalogsQuery) {
    return this.service
      .findAll(query.kind, query.includeInactive ?? false)
      .then((items) => items.map(this.toResponse));
  }

  @Get('ubigeo')
  @ApiOperation({
    summary:
      'Ubigeo tree (departments → provinces; districts when department or province is filtered)',
  })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'province', required: false })
  @ApiOkResponse({ type: UbigeoTreeResponseDto })
  getUbigeo(@Query() query: UbigeoQuery) {
    return this.service.getUbigeoTree({
      department: query.department,
      province: query.province,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT)
  @ApiOperation({
    summary: 'Create a catalog item (agents: open kinds only)',
  })
  @ApiCreatedResponse({ type: CatalogItemResponseDto })
  @ApiForbiddenResponse({
    description:
      'Administrator, foundation, or agent role required; agents limited to open kinds',
  })
  create(@Body() input: CreateCatalogItemDto, @CurrentUser() user: User) {
    return this.service.create(input, user.role).then(this.toResponse);
  }

  @Get('merges')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION)
  @ApiOperation({ summary: 'List catalog merges, newest first' })
  @ApiQuery({ name: 'itemId', required: false, format: 'uuid' })
  @ApiOkResponse({ type: CatalogMergeResponseDto, isArray: true })
  @ApiForbiddenResponse({
    description: 'Administrator or foundation role required',
  })
  findMerges(
    @Query('itemId', new ParseUUIDPipe({ optional: true })) itemId?: string,
  ) {
    return this.service
      .findMerges(itemId)
      .then((merges) =>
        merges.map((merge) => CatalogMergeResponseDto.from(merge)),
      );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT)
  @ApiOperation({ summary: 'Update a catalog item (agents: open kinds only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CatalogItemResponseDto })
  @ApiForbiddenResponse({
    description:
      'Administrator, foundation, or agent role required; agents limited to open kinds',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el ítem del catálogo.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCatalogItemDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, input, user.role).then(this.toResponse);
  }

  @Post(':id/archive')
  @Roles(UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT)
  @ApiOperation({
    summary:
      'Archive (soft-deactivate) a non-system catalog item (agents: open kinds only)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CatalogItemResponseDto })
  @ApiForbiddenResponse({
    description:
      'Administrator, foundation, or agent role required; agents limited to open kinds',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el ítem del catálogo.' })
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.archive(id, user.role).then(this.toResponse);
  }

  @Post(':id/merge-into/:targetId')
  @Roles(UserRole.ADMIN)
  @AuditContext(AuditContextKind.ADMIN_ADJUSTMENT)
  @ApiOperation({
    summary:
      'Merge a duplicate catalog item into another: re-points every stored reference and archives the duplicate',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Duplicate item' })
  @ApiParam({ name: 'targetId', format: 'uuid', description: 'Item to keep' })
  @ApiCreatedResponse({ type: CatalogMergeResponseDto })
  @ApiBadRequestResponse({
    description:
      'Different kinds, same item, system source item, or archived target',
  })
  @ApiConflictResponse({ description: 'Ese ítem ya fue fusionado.' })
  @ApiForbiddenResponse({ description: 'Esta acción la puede hacer solo un administrador.' })
  @ApiNotFoundResponse({ description: 'No se encontró el ítem del catálogo.' })
  merge(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @CurrentUser() user: User,
  ) {
    return this.service
      .merge(id, targetId, user)
      .then((merge) => CatalogMergeResponseDto.from(merge));
  }

  private toResponse(
    this: void,
    item: Parameters<typeof CatalogItemResponseDto.from>[0],
  ): CatalogItemResponseDto {
    return CatalogItemResponseDto.from(item);
  }
}
