import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PatientRole } from '../../database/entities/patient-role.enum';
import { PatientStatus } from '../../database/entities/patient-status.enum';

export class ListPatientsDto {
  @ApiPropertyOptional({ enum: PatientRole })
  @IsOptional()
  @IsIn(Object.values(PatientRole))
  role?: PatientRole;

  @ApiPropertyOptional({ enum: PatientStatus })
  @IsOptional()
  @IsIn(Object.values(PatientStatus))
  status?: PatientStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ type: Number, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
