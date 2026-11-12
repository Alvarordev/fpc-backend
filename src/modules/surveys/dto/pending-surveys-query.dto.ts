import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SurveyType } from '../../../database/entities/survey.entity';

export class PendingSurveysQueryDto {
  @ApiProperty({ enum: SurveyType })
  @IsEnum(SurveyType)
  type!: SurveyType;
}
