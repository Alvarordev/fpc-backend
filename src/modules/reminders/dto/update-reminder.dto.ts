import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  ReminderChannel,
  ReminderLead,
} from '../../../database/entities/reminder-delivery.enums';

export class UpdateReminderDto {
  @IsOptional() @IsUUID() assignedAgentId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() healthCenterId?: string;

  @ApiPropertyOptional({ enum: ReminderChannel })
  @IsOptional()
  @IsEnum(ReminderChannel)
  channel?: ReminderChannel;

  @ApiPropertyOptional({ enum: ReminderLead })
  @IsOptional()
  @IsEnum(ReminderLead)
  lead?: ReminderLead;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  remindAt?: string;
}
