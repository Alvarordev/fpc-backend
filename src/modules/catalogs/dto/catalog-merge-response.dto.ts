import { ApiProperty } from '@nestjs/swagger';
import { CatalogMerge } from '../../../database/entities/catalog-merge.entity';

export class CatalogMergeResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() kind!: string;
  @ApiProperty({ format: 'uuid' }) sourceItemId!: string;
  @ApiProperty({ format: 'uuid' }) targetItemId!: string;
  @ApiProperty() sourceCode!: string;
  @ApiProperty() targetCode!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) actorUserId!: string | null;
  @ApiProperty({
    description: 'Re-pointed rows per table.column',
    type: 'object',
    additionalProperties: { type: 'integer' },
  })
  affectedRows!: Record<string, number>;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;

  static from(merge: CatalogMerge): CatalogMergeResponseDto {
    return {
      id: merge.id,
      kind: merge.kind,
      sourceItemId: merge.sourceItemId,
      targetItemId: merge.targetItemId,
      sourceCode: merge.sourceCode,
      targetCode: merge.targetCode,
      actorUserId: merge.actorUserId,
      affectedRows: merge.affectedRows,
      createdAt: merge.createdAt,
    };
  }
}
