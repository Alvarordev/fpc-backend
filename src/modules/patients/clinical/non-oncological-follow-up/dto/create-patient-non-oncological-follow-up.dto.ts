import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DATE_ONLY_PATTERN } from '../../../../../shared/date-only/date-only.util';
import { DurationDto } from '../../../../../shared/duration/duration.dto';
import { PatientNonOncologicalFollowUpStatus } from '../../../../../database/entities/patient-non-oncological-follow-up-status.enum';

export class CreatePatientNonOncologicalFollowUpDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  followUpId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  enrollmentId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  diagnosticStatusEventId?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  diagnosis!: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  occurredOn?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  receivesTreatment?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  treatmentName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  medication?: string | null;

  @ApiPropertyOptional({ type: DurationDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  treatmentFrequency?: DurationDto | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hasControls?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  controlSpecialty?: string | null;

  @ApiPropertyOptional({ type: DurationDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  controlPeriodicity?: DurationDto | null;

  @ApiPropertyOptional({ enum: PatientNonOncologicalFollowUpStatus })
  @IsOptional()
  @IsIn(Object.values(PatientNonOncologicalFollowUpStatus))
  status?: PatientNonOncologicalFollowUpStatus;
}

export class UpdatePatientNonOncologicalFollowUpDto extends PartialType(
  OmitType(CreatePatientNonOncologicalFollowUpDto, [
    'followUpId',
    'enrollmentId',
  ] as const),
) {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  dischargedOn?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  dischargeReason?: string | null;
}
