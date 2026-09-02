import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  AppointmentBeneficiaryType,
  AppointmentModality,
  AppointmentStatus,
} from '../../../database/entities/psychooncology-appointment.entity';
import { DATE_ONLY_PATTERN } from '../../../shared/date-only/date-only.util';

export class CreateHistoricalPsychooncologyAppointmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  volunteerId?: string;

  @ApiPropertyOptional({
    description:
      'Use the system profile when the original volunteer is unknown',
  })
  @IsOptional()
  @IsBoolean()
  useAnonymousVolunteer?: boolean;

  @ApiPropertyOptional({ enum: AppointmentBeneficiaryType })
  @IsOptional()
  @IsEnum(AppointmentBeneficiaryType)
  beneficiaryType?: AppointmentBeneficiaryType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  companionId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  followUpId?: string;

  @ApiPropertyOptional({ format: 'email', nullable: true })
  @IsOptional()
  @IsEmail()
  patientEmail?: string | null;

  @ApiPropertyOptional({ format: 'uri', nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  zoomLink?: string | null;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  sessionNumber!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAdditionalSession?: boolean;

  @ApiProperty({ enum: AppointmentModality })
  @IsEnum(AppointmentModality)
  modality!: AppointmentModality;

  @ApiProperty({ enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  scheduledOn!: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN)
  completedOn?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schedulingNotes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noAnswerNote?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  satisfactionRating?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  satisfactionComment?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topicAddressed?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionDetails?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  additionalObservations?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recommendations?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referral?: string | null;
}
