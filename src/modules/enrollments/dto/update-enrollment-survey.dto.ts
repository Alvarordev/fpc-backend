import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateEnrollmentSurveyDto {
  @ApiProperty({ minimum: 0, maximum: 5, type: Number, description: '0 = No indica' })
  @IsInt()
  @Min(0)
  @Max(5)
  followUpQualityRating!: number;
}
