import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DeactivationReason } from '../../../database/entities/deactivation-reason.enum';

/** OTHER only exists for legacy deactivations; new ones pick a catalog reason. */
export const DEACTIVATION_REASONS = Object.values(DeactivationReason).filter(
  (reason) => reason !== DeactivationReason.OTHER,
);

export class DeactivatePatientDto {
  @ApiProperty({ enum: DEACTIVATION_REASONS })
  @IsIn(DEACTIVATION_REASONS)
  reason!: DeactivationReason;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  deceasedAt?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Follow-up in which the deactivation was decided',
  })
  @IsOptional()
  @IsUUID()
  followUpId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'When the patient actually left the program (historical loads). Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ description: 'Free-text notes about the dropout' })
  @IsOptional()
  @IsString()
  reasonDetail?: string;
}

export class ReactivatePatientDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Follow-up in which the patient came back',
  })
  @IsOptional()
  @IsUUID()
  followUpId?: string;
}
