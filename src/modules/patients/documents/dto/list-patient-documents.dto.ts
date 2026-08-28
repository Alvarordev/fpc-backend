import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PatientDocumentType } from '../../../../database/entities/patient-document.entity';

function emptyStringToUndefined({ value }: { value: unknown }): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

function parseBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export class ListPatientDocumentsDto {
  @ApiPropertyOptional({ enum: PatientDocumentType })
  @IsOptional()
  @IsEnum(PatientDocumentType)
  documentType?: PatientDocumentType;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsUUID()
  diagnosisId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsUUID()
  treatmentId?: string;

  @ApiPropertyOptional({ default: false })
  @Transform(parseBoolean)
  @IsOptional()
  @IsBoolean()
  includeArchived = false;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ type: Number, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
