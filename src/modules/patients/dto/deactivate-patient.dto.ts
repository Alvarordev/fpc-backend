import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DeactivationReason } from '../../../database/entities/deactivation-reason.enum';

@ValidatorConstraint({ name: 'validDeactivationDetail', async: false })
class ValidDeactivationDetailConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const reason = (args.object as DeactivatePatientDto).reason;
    return reason === DeactivationReason.OTHER
      ? typeof value === 'string' && value.trim().length > 0
      : value === undefined || value === null;
  }

  defaultMessage(): string {
    return 'detail is required only when reason is OTHER';
  }
}

export class DeactivatePatientDto {
  @ApiProperty({ enum: DeactivationReason })
  @IsIn(Object.values(DeactivationReason))
  reason!: DeactivationReason;

  @ApiPropertyOptional()
  @Validate(ValidDeactivationDetailConstraint)
  detail?: string;

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
