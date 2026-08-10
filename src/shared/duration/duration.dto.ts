import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { DurationUnit } from '../../database/entities/duration-unit.enum';

export class DurationDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  valueMin!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  valueMax?: number;

  @ApiProperty({ enum: DurationUnit })
  @IsIn(Object.values(DurationUnit))
  unit!: DurationUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
