import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

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
