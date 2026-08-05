import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { APPOINTMENT_TIME_PATTERN } from '../patients/clinical/medical-appointments/patient-medical-appointments.dto';

export class CreateMedicalAppointmentDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsString() specialty!: string;
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @Matches(APPOINTMENT_TIME_PATTERN) appointmentTime?: string;
  @IsOptional() @IsDateString() nextAppointmentDate?: string;
  @IsOptional() @IsBoolean() hasReferralSheet?: boolean;
  @IsOptional() @IsString() referredTo?: string;
  @IsOptional() @IsString() difficulties?: string;
  @IsOptional() @IsBoolean() isFirstConsultation?: boolean;
}

/**
 * `specialty` is deliberately absent: the current-record versioning
 * (patientId, specialty) uniquely identifies which row this update
 * replaces, so changing it would orphan the old "current" row. Create a
 * new appointment instead.
 */
export class UpdateMedicalAppointmentDto {
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @Matches(APPOINTMENT_TIME_PATTERN) appointmentTime?: string;
  @IsOptional() @IsDateString() nextAppointmentDate?: string;
  @IsOptional() @IsBoolean() hasReferralSheet?: boolean;
  @IsOptional() @IsString() referredTo?: string;
  @IsOptional() @IsString() difficulties?: string;
  @IsOptional() @IsBoolean() isFirstConsultation?: boolean;
  @IsString() @IsNotEmpty() changeReason!: string;
}

export class FindMedicalAppointmentsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  healthCenterId?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Include superseded (non-current) versions. Default false.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeHistory?: boolean;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ type: Number, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
