import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';
import {
  AppointmentModality,
  AppointmentReminderMode,
} from '../../../database/entities/psychooncology-appointment.entity';

export class ReschedulePsychooncologyAppointmentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Free availability slot; it may belong to another volunteer',
  })
  @IsUUID()
  availabilityId!: string;
  @ApiPropertyOptional({ enum: AppointmentModality })
  @IsOptional()
  @IsIn(Object.values(AppointmentModality))
  modality?: AppointmentModality;
  @ApiPropertyOptional({
    description:
      'Defaults to the current link when the volunteer does not change',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  zoomLink?: string;
  @IsOptional() @IsString() schedulingNotes?: string;
  @ApiPropertyOptional({ enum: AppointmentReminderMode })
  @IsOptional()
  @IsIn(Object.values(AppointmentReminderMode))
  reminderMode?: AppointmentReminderMode;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  remindAt?: string;
}
