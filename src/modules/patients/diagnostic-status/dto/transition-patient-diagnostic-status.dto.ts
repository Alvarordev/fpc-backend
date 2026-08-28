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
import { CreatePatientDiagnosisDto } from '../../clinical/diagnoses/dto/create-patient-diagnosis.dto';

export class DiagnosticStatusDiagnosisDto extends OmitType(
  CreatePatientDiagnosisDto,
  ['followUpId'] as const,
) {}

export class TransitionPatientDiagnosticStatusDto {
  @ApiProperty({ enum: PatientDiagnosticStatus })
  @IsIn(Object.values(PatientDiagnosticStatus))
  status!: PatientDiagnosticStatus;

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
}
