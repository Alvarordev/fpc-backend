import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../../../database/entities/follow-up.enums';
import { ReminderStatus } from '../../../database/entities/reminder-status.enum';
import {
  AppointmentModality,
  AppointmentStatus,
} from '../../../database/entities/psychooncology-appointment.entity';

export enum PatientTimelineEventKind {
  FOLLOW_UP = 'FOLLOW_UP',
  REMINDER = 'REMINDER',
  PSYCHOONCOLOGY_APPOINTMENT = 'PSYCHOONCOLOGY_APPOINTMENT',
}

export class PatientTimelineQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class FollowUpTimelineEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: [PatientTimelineEventKind.FOLLOW_UP] })
  kind!: PatientTimelineEventKind.FOLLOW_UP;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ enum: FollowUpStatus }) status!: FollowUpStatus;
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty({ enum: FollowUpType }) type!: FollowUpType;
  @ApiProperty({ enum: FollowUpPurpose }) purpose!: FollowUpPurpose;
  @ApiProperty({ nullable: true, type: String }) notes!: string | null;
}

export class ReminderTimelineEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: [PatientTimelineEventKind.REMINDER] })
  kind!: PatientTimelineEventKind.REMINDER;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ enum: ReminderStatus }) status!: ReminderStatus;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  followUpId!: string | null;
  @ApiProperty() description!: string;
}

export class PsychooncologyAppointmentTimelineEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({
    enum: [PatientTimelineEventKind.PSYCHOONCOLOGY_APPOINTMENT],
  })
  kind!: PatientTimelineEventKind.PSYCHOONCOLOGY_APPOINTMENT;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty({ format: 'uuid', nullable: true }) followUpId!: string | null;
  @ApiProperty({ enum: AppointmentModality }) modality!: AppointmentModality;
  @ApiProperty({ minimum: 1 }) sessionNumber!: number;
}

export type PatientTimelineEventDto =
  | FollowUpTimelineEventDto
  | ReminderTimelineEventDto
  | PsychooncologyAppointmentTimelineEventDto;

export class PatientTimelineResponseDto {
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(FollowUpTimelineEventDto) },
        { $ref: getSchemaPath(ReminderTimelineEventDto) },
        { $ref: getSchemaPath(PsychooncologyAppointmentTimelineEventDto) },
      ],
      discriminator: {
        propertyName: 'kind',
        mapping: {
          FOLLOW_UP: getSchemaPath(FollowUpTimelineEventDto),
          REMINDER: getSchemaPath(ReminderTimelineEventDto),
          PSYCHOONCOLOGY_APPOINTMENT: getSchemaPath(
            PsychooncologyAppointmentTimelineEventDto,
          ),
        },
      },
    },
  })
  data!: PatientTimelineEventDto[];

  @ApiProperty({ minimum: 0 }) total!: number;
}
