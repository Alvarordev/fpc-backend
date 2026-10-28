import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  AppointmentBeneficiaryType,
  AppointmentModality,
  AppointmentReminderMode,
  AppointmentStatus,
} from '../../../database/entities/psychooncology-appointment.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const RESULT_STATUSES = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
] as const;

export class UpdatePsychooncologyAppointmentDto {
  @ApiPropertyOptional({ enum: AppointmentBeneficiaryType })
  @IsOptional()
  @IsIn(Object.values(AppointmentBeneficiaryType))
  beneficiaryType?: AppointmentBeneficiaryType;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  companionId?: string | null;
  @ApiPropertyOptional({
    enum: RESULT_STATUSES,
    description:
      'Session result. Cancel and reschedule have their own endpoints.',
  })
  @IsOptional()
  @IsIn(RESULT_STATUSES)
  status?: AppointmentStatus;
  @IsOptional()
  @IsIn(Object.values(AppointmentModality))
  modality?: AppointmentModality;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  zoomLink?: string | null;
  @IsOptional() @IsString() patientEmail?: string;
  @IsOptional() @IsBoolean() isAdditionalSession?: boolean;
  @IsOptional() @IsString() schedulingNotes?: string | null;
  @ApiPropertyOptional({ enum: AppointmentReminderMode })
  @IsOptional()
  @IsIn(Object.values(AppointmentReminderMode))
  reminderMode?: AppointmentReminderMode;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Required when reminderMode is CUSTOM',
  })
  @IsOptional()
  @IsDateString()
  remindAt?: string;
  @IsOptional() @IsString() noAnswerNote?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(5) satisfactionRating?: number | null;
  @IsOptional() @IsString() satisfactionComment?: string | null;
  @IsOptional() @IsString() topicAddressed?: string;
  @IsOptional() @IsString() sessionDetails?: string;
  @IsOptional() @IsString() additionalObservations?: string;
  @IsOptional() @IsString() recommendations?: string;
  @IsOptional() @IsString() referral?: string;
}
