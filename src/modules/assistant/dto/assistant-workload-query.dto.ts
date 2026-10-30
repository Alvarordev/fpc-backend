import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class AssistantWorkloadQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^P-\d{3,}$/)
  patient?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsBoolean()
  hasEmail?: boolean;

  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsInt()
  @Min(0)
  offset = 0;
}
