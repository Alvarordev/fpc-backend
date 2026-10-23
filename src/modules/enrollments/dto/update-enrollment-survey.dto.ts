import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateEnrollmentSurveyDto {
  @ApiProperty({ minimum: 1, maximum: 5, type: Number })
  @IsInt()
  @Min(1)
  @Max(5)
  followUpQualityRating!: number;
}
