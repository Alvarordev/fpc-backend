import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogItem } from '../../../database/entities/catalog-item.entity';

export class CatalogItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() kind!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ nullable: true }) parentCode!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() isSystem!: boolean;
  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  metadata!: Record<string, unknown> | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static from(item: CatalogItem): CatalogItemResponseDto {
    return {
      id: item.id,
      kind: item.kind,
      code: item.code,
      label: item.label,
      parentCode: item.parentCode,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      isSystem: item.isSystem,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
