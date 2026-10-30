import { ApiProperty } from '@nestjs/swagger';
import {
  SurveyChannel,
  SurveyType,
} from '../../../database/entities/survey.entity';
import { SurveyScriptVariant } from '../survey-scripts';

export class SurveyResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ enum: SurveyType }) type!: SurveyType;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
  @ApiProperty({ nullable: true, type: String }) comment!: string | null;
  @ApiProperty({ enum: SurveyChannel }) channel!: SurveyChannel;
  @ApiProperty({ format: 'date-time' }) answeredAt!: Date;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  followUpId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  psychooncologyAppointmentId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  actorUserId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class SurveyScriptResponseDto {
  @ApiProperty({ enum: SurveyType }) type!: SurveyType;
  @ApiProperty({ enum: SurveyScriptVariant, nullable: true })
  variant!: SurveyScriptVariant | null;
  @ApiProperty() text!: string;
}

export class PendingThreeMonthSurveyDto {
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ nullable: true, type: String }) documentNumber!: string | null;
  @ApiProperty({ nullable: true, type: String }) primaryPhone!: string | null;
  @ApiProperty({ format: 'date' }) enrolledOn!: string;
  @ApiProperty() daysSinceEnrollment!: number;
}
