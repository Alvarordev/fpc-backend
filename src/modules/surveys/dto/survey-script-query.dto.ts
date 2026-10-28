import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SurveyType } from '../../../database/entities/survey.entity';
import { SurveyScriptVariant } from '../survey-scripts';

export class SurveyScriptQueryDto {
  @ApiProperty({ enum: SurveyType })
  @IsEnum(SurveyType)
  type!: SurveyType;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Fills the patient name and, for ENROLLMENT, picks the variant from the health phase.',
  })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({
    enum: SurveyScriptVariant,
    description:
      'ENROLLMENT only. Overrides the variant taken from the patient.',
  })
  @IsOptional()
  @IsEnum(SurveyScriptVariant)
  variant?: SurveyScriptVariant;
}
