import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';
import {
  AppointmentModality,
  AppointmentStatus,
} from '../database/entities/psychooncology-appointment.entity';
import { AvailabilityStatus } from '../database/entities/volunteer-availability.entity';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class VolunteerCalendarQueryDto {
  @ApiProperty({ format: 'date', example: '2026-08-01' })
  @IsDateString()
  @Matches(DATE_PATTERN)
  from!: string;

  @ApiProperty({ format: 'date', example: '2026-08-31' })
  @IsDateString()
  @Matches(DATE_PATTERN)
  to!: string;
}

export class VolunteerCalendarAvailabilityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date' }) date!: string;
  @ApiProperty({ example: '09:00:00' }) startTime!: string;
  @ApiProperty({ example: '10:00:00' }) endTime!: string;
  @ApiProperty({ enum: AvailabilityStatus }) status!: AvailabilityStatus;
}

export class VolunteerCalendarAppointmentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() patientName!: string;
  @ApiProperty({ format: 'uuid' }) availabilityId!: string;
  @ApiProperty({ enum: AppointmentModality }) modality!: AppointmentModality;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty({ format: 'date-time' }) scheduledAt!: Date;
}

export class VolunteerCalendarVolunteerDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() specialty!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: VolunteerCalendarAvailabilityDto, isArray: true })
  availabilitySlots!: VolunteerCalendarAvailabilityDto[];
  @ApiProperty({ type: VolunteerCalendarAppointmentDto, isArray: true })
  appointments!: VolunteerCalendarAppointmentDto[];
}

export class VolunteerCalendarResponseDto {
  @ApiProperty({ type: VolunteerCalendarVolunteerDto, isArray: true })
  volunteers!: VolunteerCalendarVolunteerDto[];
}
