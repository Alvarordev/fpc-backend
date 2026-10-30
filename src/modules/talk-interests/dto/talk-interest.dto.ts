import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CompanionTalkInterest } from '../../../database/entities/companion-talk-interest.entity';

export class CreateTalkInterestDto {
  @ApiProperty({
    description: 'Código (o nombre) del catálogo educational_talk',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  talk!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Seguimiento en que se registró',
  })
  @IsOptional()
  @IsUUID()
  followUpId?: string;
}

export class FindTalkInterestsDto {
  @ApiPropertyOptional({ description: 'Código del catálogo educational_talk' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  talk?: string;

  @ApiPropertyOptional({ description: 'Nombre del acompañante o del paciente' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ type: Number, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class TalkInterestResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() talk!: string;
  @ApiProperty() talkLabel!: string;
  @ApiProperty({ format: 'uuid' }) companionId!: string;
  @ApiProperty() companionFullName!: string;
  @ApiPropertyOptional({ nullable: true }) companionPhone!: string | null;
  @ApiPropertyOptional({ nullable: true }) companionEmail!: string | null;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() patientFullName!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  followUpId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;

  static from(
    interest: CompanionTalkInterest,
    talkLabel: string,
  ): TalkInterestResponseDto {
    return {
      id: interest.id,
      talk: interest.talk,
      talkLabel,
      companionId: interest.companionId,
      companionFullName: interest.companion.fullName,
      companionPhone: interest.companion.primaryPhone,
      companionEmail: interest.companion.email,
      patientId: interest.patientId,
      patientFullName: interest.patient.fullName,
      followUpId: interest.followUpId,
      createdAt: interest.createdAt,
    };
  }
}

export class TalkInterestListResponseDto {
  @ApiProperty({ type: TalkInterestResponseDto, isArray: true })
  data!: TalkInterestResponseDto[];
  @ApiProperty() total!: number;
}
