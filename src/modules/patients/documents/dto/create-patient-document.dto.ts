import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PatientDocumentType } from '../../../../database/entities/patient-document.entity';

function emptyStringToUndefined({ value }: { value: unknown }): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

export class CreatePatientDocumentDto {
  @ApiProperty({ enum: PatientDocumentType })
  @IsEnum(PatientDocumentType)
  documentType!: PatientDocumentType;

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

  @ApiPropertyOptional({ maxLength: 1000 })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
