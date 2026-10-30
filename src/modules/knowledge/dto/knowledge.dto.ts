import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  KnowledgeDocument,
  KnowledgeIndexStatus,
  KnowledgeStatus,
} from '../../../database/entities/knowledge-document.entity';

export class CreateKnowledgeDocumentDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;
  @ApiPropertyOptional({ default: '1', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  version = '1';
}
export class ListKnowledgeDocumentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
  @ApiPropertyOptional({ enum: KnowledgeStatus })
  @IsOptional()
  @IsEnum(KnowledgeStatus)
  status?: KnowledgeStatus;
  @ApiPropertyOptional({ type: Number, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional({ type: Number, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
export class KnowledgeDocumentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() version!: string;
  @ApiProperty() originalName!: string;
  @ApiProperty() mediaType!: string;
  @ApiProperty() size!: number;
  @ApiProperty({ enum: KnowledgeStatus }) status!: KnowledgeStatus;
  @ApiProperty({ enum: KnowledgeIndexStatus })
  indexStatus!: KnowledgeIndexStatus;
  @ApiProperty({ nullable: true, type: String }) indexError!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  publishedAt!: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  static from(doc: KnowledgeDocument): KnowledgeDocumentResponseDto {
    const {
      id,
      title,
      version,
      originalName,
      mediaType,
      size,
      status,
      indexStatus,
      indexError,
      publishedAt,
      createdAt,
      updatedAt,
    } = doc;
    return {
      id,
      title,
      version,
      originalName,
      mediaType,
      size,
      status,
      indexStatus,
      indexError,
      publishedAt,
      createdAt,
      updatedAt,
    };
  }
}
export class KnowledgeDocumentListDto {
  @ApiProperty({ type: [KnowledgeDocumentResponseDto] })
  data!: KnowledgeDocumentResponseDto[];
  @ApiProperty() total!: number;
}
export class KnowledgeLibraryStatusDto {
  @ApiProperty() publishedCount!: number;
}
