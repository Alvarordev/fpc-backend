import { ApiProperty } from '@nestjs/swagger';

export class UnmanagedNoShowsResponseDto {
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() hasUnmanagedNoShows!: boolean;
  @ApiProperty() count!: number;
  @ApiProperty({ format: 'uuid', isArray: true }) appointmentIds!: string[];
}
