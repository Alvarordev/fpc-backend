import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateRecurringAvailabilityDto {
  @ApiProperty({
    type: [Number],
    description: 'Days of the week, 0 = Sunday … 6 = Saturday',
    example: [1, 3],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @ApiProperty({ example: '09:00', description: 'Start of the block (HH:mm)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de inicio debe tener el formato HH:mm.',
  })
  startTime!: string;

  @ApiProperty({
    minimum: 1,
    maximum: 12,
    description: 'Hours of the block; it is split into 1-hour slots',
  })
  @IsInt()
  @Min(1)
  @Max(12)
  hours!: number;

  @ApiPropertyOptional({ format: 'date', description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  endDate!: string;
}
