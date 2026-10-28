import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';
import {
  AppointmentBeneficiaryType,
  AppointmentModality,
  AppointmentReminderMode,
} from '../../../database/entities/psychooncology-appointment.entity';

export class CreatePsychooncologyAppointmentDto {
  @IsUUID() patientId!: string;
  @ApiPropertyOptional({ enum: AppointmentBeneficiaryType })
  @IsOptional()
  @IsIn(Object.values(AppointmentBeneficiaryType))
  beneficiaryType?: AppointmentBeneficiaryType;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  companionId?: string | null;
  @IsUUID() availabilityId!: string;
  @IsOptional() @IsUUID() followUpId?: string;
  @IsOptional() @IsString() patientEmail?: string;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  zoomLink?: string;
  @ApiPropertyOptional({
    description:
      'Required once the base cycle already has its 4 sessions (scheduled by an agent)',
  })
  @IsOptional()
  @IsBoolean()
  isAdditionalSession?: boolean;
  @IsIn(Object.values(AppointmentModality)) modality!: AppointmentModality;
  @IsOptional() @IsString() schedulingNotes?: string;
  @ApiPropertyOptional({
    enum: AppointmentReminderMode,
    default: AppointmentReminderMode.MANUAL,
  })
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
}
