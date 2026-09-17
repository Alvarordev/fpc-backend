import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CancerStage } from '../../../../../database/entities/patient-diagnosis.entity';
import { PatientDiagnosisMode } from '../../../../../database/entities/patient-diagnosis-mode.enum';
import { DurationDto } from '../../../../../shared/duration/duration.dto';
export class CreatePatientDiagnosisDto {
  @IsUUID() followUpId!: string;
  @IsString() diagnosis!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  diagnosisOther?: string;
  @ApiProperty({
    enum: PatientDiagnosisMode,
    example: PatientDiagnosisMode.PARALLEL,
  })
  @IsIn(Object.values(PatientDiagnosisMode))
  mode!: PatientDiagnosisMode;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required when mode is REPLACE; the active diagnosis to retire',
  })
  @ValidateIf(
    (dto: CreatePatientDiagnosisDto) =>
      dto.mode === PatientDiagnosisMode.REPLACE,
  )
  @IsDefined()
  @IsUUID()
  replacementDiagnosisId?: string;
  @IsOptional() @IsIn(Object.values(CancerStage)) cancerStage?: CancerStage;
  @IsOptional() @IsDateString() diagnosisDate?: string;
  @IsOptional() @IsDateString() firstSymptomsDate?: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  referredHealthCenterId?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hasReferral?: boolean;
  @IsOptional() @IsString() diagnosisSpecialty?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  diagnosisSpecialtyOther?: string;
  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Legacy snapshot. Prefer patient_symptom_reports when a symptom report exists.',
  })
  @IsOptional()
  @IsString()
  symptomLeadingToCheckup?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  waitTimeForDiagnosis?: DurationDto;
  @IsOptional() @IsBoolean() hasMedicalReport?: boolean;
  @IsOptional() @IsBoolean() isSepaActiveReferral?: boolean;
  @IsOptional() @IsString() changeReason?: string;
}
