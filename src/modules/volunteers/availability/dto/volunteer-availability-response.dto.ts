import { ApiProperty } from '@nestjs/swagger';
import { AvailabilityStatus } from '../../../../database/entities/volunteer-availability.entity';

export class VolunteerAvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) volunteerId!: string;
  @ApiProperty({ format: 'date' }) date!: string;
  @ApiProperty({ example: '09:00:00', nullable: true }) startTime!:
    string | null;
  @ApiProperty({ example: '10:00:00', nullable: true }) endTime!: string | null;
  @ApiProperty({ enum: AvailabilityStatus }) status!: AvailabilityStatus;
  @ApiProperty() isHistorical!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}
