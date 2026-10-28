import { ApiProperty } from '@nestjs/swagger';
import { VolunteerAvailabilityResponseDto } from './volunteer-availability-response.dto';

export class RecurringAvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' }) recurrenceId!: string;
  @ApiProperty({ type: VolunteerAvailabilityResponseDto, isArray: true })
  created!: VolunteerAvailabilityResponseDto[];
  @ApiProperty({
    description: 'Slots skipped because they overlap existing availability',
  })
  skipped!: number;
}

export class RemoveRecurrenceResponseDto {
  @ApiProperty() removed!: number;
  @ApiProperty({ description: 'Reserved slots kept because they are booked' })
  keptReserved!: number;
}
