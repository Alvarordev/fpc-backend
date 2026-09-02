import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { MedicalAppointmentStatus } from '../../../database/entities/medical-appointment-status.enum';
import { DATE_ONLY_PATTERN } from '../../../shared/date-only/date-only.util';
import { APPOINTMENT_TIME_PATTERN } from '../../patients/clinical/medical-appointments/dto/appointment-time';

export class CreateHistoricalMedicalAppointmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  followUpId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  healthCenterId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  specialty!: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  appointmentDate?: string;

  @ApiPropertyOptional({ description: 'HH:mm or HH:mm:ss' })
  @IsOptional()
  @Matches(APPOINTMENT_TIME_PATTERN)
  appointmentTime?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  nextAppointmentDate?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAppointmentSpecialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasReferralSheet?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referredTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralNotProvidedReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  difficulties?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFirstConsultation?: boolean;

  @ApiProperty({ enum: MedicalAppointmentStatus })
  @IsEnum(MedicalAppointmentStatus)
  status!: MedicalAppointmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changeReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  attendedViaSepa?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  referredViaSepa?: boolean;
}
