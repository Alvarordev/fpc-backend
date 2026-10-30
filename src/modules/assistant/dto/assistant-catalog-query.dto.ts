import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CATALOG_KINDS,
  type CatalogKind,
} from '../../../database/entities/catalog-item.entity';

export class AssistantCatalogQueryDto {
  @IsIn(CATALOG_KINDS)
  kind!: CatalogKind;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsInt()
  @Min(0)
  offset = 0;
}
