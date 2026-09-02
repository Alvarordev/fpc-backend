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
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import {
  CATALOG_KINDS,
  type CatalogKind,
} from '../../database/entities/catalog-item.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CatalogsService } from './catalogs.service';
import { CatalogItemResponseDto } from './dto/catalog-item-response.dto';
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
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a catalog item' })
  @ApiCreatedResponse({ type: CatalogItemResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  create(@Body() input: CreateCatalogItemDto) {
    return this.service.create(input).then(this.toResponse);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a catalog item' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CatalogItemResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Catalog item not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCatalogItemDto,
  ) {
    return this.service.update(id, input).then(this.toResponse);
  }

  @Post(':id/archive')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Archive (soft-deactivate) a non-system catalog item',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CatalogItemResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Catalog item not found' })
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id).then(this.toResponse);
  }

  private toResponse(
    this: void,
    item: Parameters<typeof CatalogItemResponseDto.from>[0],
  ): CatalogItemResponseDto {
    return CatalogItemResponseDto.from(item);
  }
}
