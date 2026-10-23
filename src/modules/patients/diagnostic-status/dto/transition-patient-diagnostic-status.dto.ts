import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PatientDiagnosticStatus } from '../../../../database/entities/patient-diagnostic-status.enum';
import { PatientHealthSubcategory } from '../../../../database/entities/patient-health-subcategory.enum';
import { CreatePatientDiagnosisDto } from '../../clinical/diagnoses/dto/create-patient-diagnosis.dto';

export class DiagnosticStatusDiagnosisDto extends OmitType(
  CreatePatientDiagnosisDto,
  ['followUpId'] as const,
) {}

const DIAGNOSTIC_RESULT_STATUSES = [
  PatientDiagnosticStatus.CONFIRMED,
  PatientDiagnosticStatus.RULED_OUT,
] as const;

export class TransitionPatientDiagnosticStatusDto {
  @ApiProperty({ enum: DIAGNOSTIC_RESULT_STATUSES })
  @IsIn(DIAGNOSTIC_RESULT_STATUSES)
  status!: (typeof DIAGNOSTIC_RESULT_STATUSES)[number];

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  followUpId!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ type: DiagnosticStatusDiagnosisDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiagnosticStatusDiagnosisDto)
  diagnosis?: DiagnosticStatusDiagnosisDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  supportedBySepa?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    enum: PatientHealthSubcategory,
    description:
      'Required only for CONFIRMED. Defaults to ACTIVE_TREATMENT. Ignored for RULED_OUT.',
  })
  @IsOptional()
  @IsIn(Object.values(PatientHealthSubcategory))
  healthSubcategory?: PatientHealthSubcategory;
}
