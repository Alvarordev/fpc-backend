import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePatientInsuranceDto {
  @IsUUID() followUpId!: string;
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  insuranceType!: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  epsProvider?: string;
  @IsOptional() @IsString() changeReason?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() affiliatedViaSepa?: boolean;
}
