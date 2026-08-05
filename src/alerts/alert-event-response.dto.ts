import { ApiProperty } from '@nestjs/swagger';
import { AlertEventType } from '../database/entities/alert-event.entity';
import { AlertResponseDto } from './alert-response.dto';

export class AlertEventResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) alertId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) agentId!: string | null;
  @ApiProperty({ nullable: true }) agentName!: string | null;
  @ApiProperty({ enum: AlertEventType }) eventType!: AlertEventType;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class AlertTicketLookupResponseDto {
  @ApiProperty({ type: AlertResponseDto }) alert!: AlertResponseDto;
  @ApiProperty({ type: AlertEventResponseDto, isArray: true })
  events!: AlertEventResponseDto[];
  @ApiProperty() totalTimelineEvents!: number;
}
