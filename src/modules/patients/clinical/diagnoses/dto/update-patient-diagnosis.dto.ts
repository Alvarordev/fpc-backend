import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DurationDto } from '../../../../../shared/duration/duration.dto';

/**
 * Corrects an active diagnosis in place. The diagnosis code itself is not
 * editable: a different diagnosis is recorded with mode REPLACE instead.
 * Omitted fields keep their value; null clears a nullable field.
 */
export class UpdatePatientDiagnosisDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Follow-up in which the correction is recorded',
  })
  @IsUUID()
  followUpId!: string;
  @ApiProperty({ description: 'Why the diagnosis is being corrected' })
  @IsString()
  @IsNotEmpty()
  changeReason!: string;
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cancerStage?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsDateString()
  diagnosisDate?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsDateString()
  firstSymptomsDate?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsUUID()
  healthCenterId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsUUID()
  referredHealthCenterId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsBoolean()
  hasReferral?: boolean | null;
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsString()
  diagnosisSpecialty?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsString()
  diagnosisSpecialtyOther?: string | null;
  @ApiPropertyOptional({
    deprecated: true,
    nullable: true,
    description:
      'Legacy snapshot. Prefer patient_symptom_reports when a symptom report exists.',
  })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsString()
  symptomLeadingToCheckup?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diseaseEvolution?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: DurationDto,
    description:
      'Omit to recompute from the dates when both are set; null clears it.',
  })
  @ValidateIf((_, value: unknown) => value != null)
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  waitTimeForDiagnosis?: DurationDto | null;
  @IsOptional() @IsBoolean() hasMedicalReport?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsOptional()
  @IsBoolean()
  isSepaActiveReferral?: boolean | null;
}
