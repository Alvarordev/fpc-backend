import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SurveyChannel,
  SurveyType,
} from '../../../database/entities/survey.entity';

export class CreateSurveyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  patientId!: string;

  @ApiProperty({ enum: SurveyType })
  @IsEnum(SurveyType)
  type!: SurveyType;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiProperty({ enum: SurveyChannel })
  @IsEnum(SurveyChannel)
  channel!: SurveyChannel;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'When the patient answered. Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  answeredAt?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  followUpId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only for PSYCHOONCOLOGY surveys.',
  })
  @IsOptional()
  @IsUUID()
  psychooncologyAppointmentId?: string;
}
