import { ApiProperty } from '@nestjs/swagger';
import { PsychooncologyCycleCloseReason } from '../../../database/entities/psychooncology-cycle.entity';

export class PsychooncologyCycleResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ format: 'date-time' }) openedAt!: Date;
  @ApiProperty({ format: 'date-time', nullable: true }) closedAt!: Date | null;
  @ApiProperty({ enum: PsychooncologyCycleCloseReason, nullable: true })
  closeReason!: PsychooncologyCycleCloseReason | null;
  @ApiProperty({ format: 'uuid', nullable: true }) closedById!: string | null;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ description: 'Base sessions planned for a cycle' })
  baseSessions!: number;
  @ApiProperty({ description: 'Sessions not cancelled nor rescheduled' })
  sessionCount!: number;
  @ApiProperty() completedSessionCount!: number;
  @ApiProperty() additionalSessionCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}
