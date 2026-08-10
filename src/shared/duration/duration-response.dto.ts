import { ApiProperty } from '@nestjs/swagger';
import { DurationUnit } from '../../database/entities/duration-unit.enum';
import { Duration } from '../../database/entities/embedded/duration.embedded';

export class DurationResponseDto {
  @ApiProperty() valueMin!: number;
  @ApiProperty({ nullable: true }) valueMax!: number | null;
  @ApiProperty({ enum: DurationUnit }) unit!: DurationUnit;
  @ApiProperty({ nullable: true }) label!: string | null;

  static from(
    duration: Duration | null | undefined,
  ): DurationResponseDto | null {
    if (!duration || !duration.unit || duration.valueMin === null) return null;
    return {
      valueMin: Number(duration.valueMin),
      valueMax: duration.valueMax === null ? null : Number(duration.valueMax),
      unit: duration.unit,
      label: duration.label,
    };
  }
}
