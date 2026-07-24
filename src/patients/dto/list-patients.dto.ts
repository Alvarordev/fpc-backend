import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PatientRole } from '../entities/patient-role.enum';
import { PatientStatus } from '../entities/patient-status.enum';

export class ListPatientsDto {
  @IsOptional()
  @IsIn(Object.values(PatientRole))
  role?: PatientRole;

  @IsOptional()
  @IsIn(Object.values(PatientStatus))
  status?: PatientStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
