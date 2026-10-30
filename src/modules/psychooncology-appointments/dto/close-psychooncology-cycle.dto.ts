import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PsychooncologyCycleCloseReason } from '../../../database/entities/psychooncology-cycle.entity';

export class ClosePsychooncologyCycleDto {
  @ApiProperty({ enum: PsychooncologyCycleCloseReason })
  @IsIn(Object.values(PsychooncologyCycleCloseReason))
  reason!: PsychooncologyCycleCloseReason;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Defaults to now; cannot be in the future',
  })
  @IsOptional()
  @IsDateString()
  closedAt?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
